#!/usr/bin/env node
/* L4 一键保护静态敏感文件 · protect-file.cjs v1.1.0
   node protect-file.cjs --in "密码本.txt" [--password X] [--out X] [--viewer X]
                         [--mark "仅供本人查看"] [--dry-run] [--force]
   node protect-file.cjs --rekey --in "密码本.vault.json" --password 旧口令 --new-password 新口令 --force

   流程：读原文 → AES-256-GCM 加密 → 渲染不含明文的查看器 → 注入 L1 护盾
        → 明文零泄漏断言 → 通过后才写文件。

   纪律：不覆盖（除非 --force）、不联网、不修改/删除/移动原文件、
        刻意不生成明文备份（明文副本会直接抵消保护效果）、口令不写入任何文件。 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vault = require('./file-vault.cjs');
const { injectHTML, configFrom, MARK } = require('./inject.cjs');

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.slice(0, 2) !== '--') continue;
    const key = t.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && next.slice(0, 2) !== '--') { a[key] = next; i++; }
    else a[key] = 'on';
  }
  return a;
}
function sha256(b) { return crypto.createHash('sha256').update(b).digest('hex'); }
function usage() {
  console.error([
    '用法：',
    '  node protect-file.cjs --in <敏感文件> [--password 口令] [--out 密文.json] [--viewer 查看器.html]',
    '                        [--mark 水印] [--dry-run] [--force]',
    '  node protect-file.cjs --rekey --in <密文.json> --password <旧口令> [--new-password <新口令>] --force',
    '  node protect-file.cjs --verify --in <密文.json> [--source <原明文>] [--viewer <查看器.html>]',
    '',
    '--verify 口令可来自环境变量 PS_VAULT_PASS，避免出现在命令行历史中。',
    '未给 --password 时自动生成 32 字符强随机口令，仅在成功后显示一次。',
    '命令行传口令会留在进程列表/历史中，建议优先用自动生成 + --rekey 改成自己的口令。'
  ].join('\n'));
}

function loadInput(a) {
  const inPath = path.resolve(a['in']);
  if (!fs.existsSync(inPath)) throw new Error('找不到输入文件: ' + inPath);
  if (a.rekey) {
    const old = JSON.parse(fs.readFileSync(inPath, 'utf8'));
    if (!a.password || a.password === 'on') throw new Error('--rekey 需要 --password <旧口令>');
    const plain = vault.openBlob(old, a.password);
    return { inPath, plain, name: old.name || path.basename(inPath), raw: Buffer.from(plain, 'utf8'), rekey: true };
  }
  const raw = fs.readFileSync(inPath);
  return { inPath, plain: raw.toString('utf8'), name: path.basename(inPath), raw, rekey: false };
}

/** --verify：只读验收。不修改任何文件、不回显明文与口令。 */
function verifyMode(a) {
  const inPath = path.resolve(a['in']);
  if (!fs.existsSync(inPath)) { console.error('找不到密文: ' + inPath); return 2; }
  const pass = (a.password && a.password !== 'on') ? a.password : process.env.PS_VAULT_PASS;
  if (!pass) { console.error('--verify 需要 --password <口令> 或环境变量 PS_VAULT_PASS'); return 2; }
  const blobJson = fs.readFileSync(inPath, 'utf8');
  let blob;
  try { blob = JSON.parse(blobJson); } catch (e) { console.error('密文 JSON 解析失败: ' + e.message); return 2; }

  let plain = '', ok = true, err = '';
  try { plain = vault.openBlob(blob, pass); } catch (e) { ok = false; err = e.message; }

  const stem = inPath.replace(/\.vault\.json$/i, '');
  const viewPath = a.viewer ? path.resolve(a.viewer) : path.resolve(stem + '·加密查看器.html');
  const srcPath = a.source ? path.resolve(a.source) : null;
  const view = fs.existsSync(viewPath) ? fs.readFileSync(viewPath, 'utf8') : '';
  const src = srcPath && fs.existsSync(srcPath) ? fs.readFileSync(srcPath) : null;

  const report = {
    密文: inPath,
    口令可解密: ok,
    解密字节: ok ? Buffer.byteLength(plain, 'utf8') : 0,
    解密错误: err || '（无）',
    密文明文零泄漏: vault.assertNoPlaintext(blobJson, plain).ok,
    查看器: view ? viewPath : '（未找到）',
    查看器含护盾标记: view.indexOf(MARK) >= 0,
    查看器含解锁表单: view.indexOf('id="unlockForm"') >= 0,
    查看器明文零泄漏: view ? vault.assertNoPlaintext(view, plain).ok : false,
    原文件: srcPath || '（未指定 --source）',
    原文件与解密内容逐字一致: src ? (ok && plain === src.toString('utf8')) : null,
    原文件SHA256: src ? crypto.createHash('sha256').update(src).digest('hex') : '（未指定）'
  };
  console.log(JSON.stringify(report, null, 2));
  const bad = Object.keys(report).filter(k => report[k] === false);
  console.log(bad.length ? '验收未通过: ' + bad.join('、') : '验收通过：所有布尔检查项为 true');
  return bad.length ? 1 : 0;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a['in']) { usage(); process.exit(2); }
  if (a.verify) { process.exitCode = verifyMode(a); return; }
  const dry = !!a['dry-run'];

  let input;
  try { input = loadInput(a); }
  catch (e) { console.error('输入失败: ' + e.message); process.exit(2); }

  const autoPass = input.rekey ? !a['new-password'] : (!a.password || a.password === 'on');
  const pass = input.rekey
    ? (a['new-password'] || vault.generatePassphrase())
    : ((!a.password || a.password === 'on') ? vault.generatePassphrase() : a.password);

  const blob = vault.sealText(input.plain, pass, input.name);
  const blobJson = JSON.stringify(blob, null, 2);
  const cfg = configFrom(a);
  const viewer = vault.renderViewer(blob, { date: new Date().toISOString().slice(0, 10) });
  const inj = injectHTML(viewer, cfg);
  const html = inj.html;

  /* 写盘前的两道硬闸门 */
  const c1 = vault.assertNoPlaintext(blobJson, input.plain);
  const c2 = vault.assertNoPlaintext(html, input.plain);
  if (!c1.ok || !c2.ok) {
    console.error(JSON.stringify({ 错误: '明文零泄漏自检未通过，已中止，未写入任何文件', 密文: c1, 查看器: c2 }, null, 2));
    process.exit(4);
  }
  const netLeak = /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie/.test(viewer);
  if (netLeak) { console.error('查看器模板检出网络/存储 API，已中止，未写入任何文件。'); process.exit(4); }
  if (html.indexOf(MARK) < 0) { console.error('护盾注入标记缺失，已中止。'); process.exit(4); }

  const stem = input.inPath.replace(/\.vault\.json$/i, '').replace(/\.[^.\\/]+$/, '');
  const outPath = a.out ? path.resolve(a.out)
    : (input.rekey ? input.inPath : path.resolve(stem + '.vault.json'));
  const viewerPath = a.viewer ? path.resolve(a.viewer) : path.resolve(stem + '·加密查看器.html');

  if (!dry) {
    for (const p of [outPath, viewerPath]) {
      if (fs.existsSync(p) && !a.force) {
        console.error('输出文件已存在，为不覆盖已有内容已停止: ' + p +
          '\n如需覆盖请显式加 --force，或换一个 --out / --viewer。');
        process.exit(3);
      }
    }
  }

  const report = {
    输入: input.inPath,
    模式: input.rekey ? 'rekey（更换口令）' : 'protect（首次加密）',
    原文字节: input.raw.length,
    原文SHA256: sha256(input.raw),
    原文件是否改动: false,
    密文: outPath,
    查看器: viewerPath,
    密文格式: { 版本: blob.v, 算法: blob.alg, KDF迭代: blob.iter, 盐字节: 16, IV字节: 12, 认证标签字节: 16 },
    护盾配置: cfg,
    护盾标记: true,
    明文零泄漏: { 密文: c1, 查看器: c2 },
    查看器无网络与存储API: !netLeak,
    运行模式: dry ? 'dry-run（不写文件）' : '写入'
  };
  console.log(JSON.stringify(report, null, 2));

  if (dry) { console.log('dry-run 完成：未创建任何文件，未显示口令。'); return; }

  fs.writeFileSync(outPath, blobJson, 'utf8');
  fs.writeFileSync(viewerPath, html, 'utf8');
  console.log('已写入密文与已注入护盾的查看器。原文件保持原样：未修改、未删除、未生成明文备份。');
  if (autoPass) {
    console.log('\n【自动生成的口令 · 仅显示这一次 · 请立即保存 · 丢失不可恢复】\n' + pass);
    console.log('改成自己记得的口令：node protect-file.cjs --rekey --in "' + outPath +
      '" --password "<旧口令>" --new-password "<新口令>" --force');
  }
}

if (require.main === module) main();
module.exports = { parseArgs, loadInput };
