#!/usr/bin/env node
/* 一键插入隐私防护按钮 · 注入器 v1.0.0
   把 L1 防护插入任意 HTML：纯追加、不改原文、幂等、默认输出新文件、零外部依赖。 */
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const MARK = '<!-- privacy-shield:v1 -->';

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
function bool(v, dflt) {
  if (v === undefined) return dflt;
  return !/^(off|0|false|no|关)$/i.test(String(v));
}
function configFrom(a) {
  return {
    mark: a.mark || '仅供本人查看',
    hotkey: a.hotkey || 'Ctrl+Alt+H',
    autoBlur: bool(a['auto-blur'], true),
    watermark: bool(a.watermark, true),
    blockCopy: bool(a['block-copy'], false),
    blockUpload: bool(a['block-upload'], false),
    allow: String(a.allow || '').split(',').map(s => s.trim()).filter(Boolean),
    position: a.position || 'bottom-right',
    level: 'L1-web'
  };
}

/** 纯函数：返回注入后的 HTML。原文只在 </head> / </body> 前追加，一字不改。 */
function injectHTML(src, cfg) {
  if (src.indexOf(MARK) >= 0) return { html: src, skipped: true, reason: '已注入（幂等）' };
  const css = fs.readFileSync(path.join(DIR, 'shield.css'), 'utf8');
  const js = fs.readFileSync(path.join(DIR, 'shield.web.js'), 'utf8');
  const cfgLine = 'window.__PS_CONFIG__ = ' + JSON.stringify(cfg) + ';';
  const styleBlock = MARK + '\n<style id="psStyle" data-ps="css">\n' + css + '\n</style>';
  const scriptBlock = '<script id="psRuntime" data-ps="runtime">\n' + cfgLine + '\n' + js + '\n</script>';
  let out = src;
  if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, () => styleBlock + '\n</head>');
  else out = styleBlock + '\n' + out;
  if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, () => scriptBlock + '\n</body>');
  else out = out + '\n' + scriptBlock;
  return { html: out, skipped: false, css: css.length, js: js.length };
}

const DEMO = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>隐私防护注入示例</title>
<style>body{margin:0;background:#0f1622;color:#e8eef8;font:15px/1.8 system-ui,"Microsoft YaHei",sans-serif;padding:40px}
h1{color:#ffd479}p{max-width:680px;color:#b8c6da}.row{display:flex;gap:14px;margin-top:18px}
.card{background:#182338;border:1px solid #2b3a52;border-radius:12px;padding:16px;width:200px}</style>
</head><body>
<h1>隐私防护注入示例</h1>
<p>这一页用来验证悬浮开关：单击右下角小球可一键遮蔽，双击或右键打开设置。<br>
下面的「敏感数据」用于确认遮蔽后是否完全不可见。</p>
<div class="row"><div class="card">客户名单：张三 / 李四 / 王五</div><div class="card">合同金额：¥ 1,280,000</div></div>
<p style="margin-top:26px;color:#7f8fa6">遮蔽层应为全不透明，截屏 / 录屏 / 远控都只能拍到遮板。</p>
</body></html>`;

function main() {
  const a = parseArgs(process.argv.slice(2));
  const cfg = configFrom(a);
  const isDemo = !!a.demo;
  let src, srcName;
  if (isDemo) {
    src = DEMO; srcName = '<内置示例>';
  } else {
    if (!a['in']) { console.error('用法: node inject.cjs --in <HTML> [--out <HTML>] [--demo] [--dry-run]'); process.exit(2); }
    const inPath = path.resolve(a['in']);
    if (!fs.existsSync(inPath)) { console.error('找不到输入文件: ' + inPath); process.exit(2); }
    src = fs.readFileSync(inPath, 'utf8'); srcName = inPath;
  }
  const r = injectHTML(src, cfg);
  let outPath;
  if (a.out) outPath = path.resolve(a.out);
  else if (isDemo) outPath = path.resolve('privacy-shield-demo.html');
  else outPath = path.resolve(String(a['in']).replace(/(\.html?|\.htm)?$/i, '') + '.shielded.html');

  const report = {
    输入: srcName,
    输出: outPath,
    原文字节: Buffer.byteLength(src, 'utf8'),
    注入后字节: Buffer.byteLength(r.html, 'utf8'),
    幂等跳过: !!r.skipped,
    配置: cfg,
    模式: a['dry-run'] ? 'dry-run（不写文件）' : '写入'
  };
  console.log(JSON.stringify(report, null, 2));

  if (r.skipped) { console.log('输入已含防护标记，未做任何改动。'); return; }
  if (a['dry-run']) { console.log('dry-run 完成：未创建任何文件。'); return; }
  if (fs.existsSync(outPath) && !a.force) {
    console.error('输出文件已存在，为不覆盖已有内容已停止：' + outPath + '\n如需覆盖请显式加 --force，或换一个 --out。');
    process.exit(3);
  }
  fs.writeFileSync(outPath, r.html, 'utf8');
  console.log('已写入: ' + outPath);
}

module.exports = { injectHTML, parseArgs, configFrom, DEMO, MARK };
if (require.main === module) main();
