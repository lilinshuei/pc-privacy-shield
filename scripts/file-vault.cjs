#!/usr/bin/env node
/* L4 静态敏感文件加密层 · file-vault.cjs v1.1.0
   Node 端 AES-256-GCM + PBKDF2-SHA256，密文二进制格式与浏览器 WebCrypto 兼容。

   blob = { v:2, alg, iter, salt:b64(16B), iv:b64(12B), data:b64(ct||tag16B), name, bytes }
   Node 的 GCM authTag 必须拼在密文末尾，才与 crypto.subtle.decrypt 的入参一致。

   纪律：不联网、不写宿主目录以外的路径、不生成明文副本、不删改原文件。 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DIR = __dirname;

const VERSION = 2;
const ALG = 'AES-GCM/PBKDF2-SHA256';
const ITER = 600000;                 // OWASP 2023 对 PBKDF2-HMAC-SHA256 的建议值
const SALT_LEN = 16, IV_LEN = 12, KEY_LEN = 32, TAG_LEN = 16;

function generatePassphrase() {
  return crypto.randomBytes(24).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');   // 32 字符 URL-safe
}

function sealText(text, passphrase, name) {
  if (typeof text !== 'string') throw new TypeError('text 必须是字符串');
  if (!passphrase) throw new Error('口令不能为空');
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = crypto.pbkdf2Sync(passphrase, salt, ITER, KEY_LEN, 'sha256');
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(Buffer.from(text, 'utf8')), c.final()]);
  const tag = c.getAuthTag();
  return {
    v: VERSION,
    alg: ALG,
    iter: ITER,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    data: Buffer.concat([ct, tag]).toString('base64'),
    name: String(name || ''),
    bytes: Buffer.byteLength(text, 'utf8')
  };
}

function openBlob(blob, passphrase) {
  if (!blob || blob.v !== VERSION) throw new Error('不支持的密文版本');
  if (!passphrase) throw new Error('口令不能为空');
  const salt = Buffer.from(blob.salt, 'base64');
  const iv = Buffer.from(blob.iv, 'base64');
  const raw = Buffer.from(blob.data, 'base64');
  if (raw.length <= TAG_LEN) throw new Error('密文长度异常');
  const ct = raw.subarray(0, raw.length - TAG_LEN);
  const tag = raw.subarray(raw.length - TAG_LEN);
  const key = crypto.pbkdf2Sync(passphrase, salt, blob.iter, KEY_LEN, 'sha256');
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 用模板渲染查看器 HTML（尚未注入护盾）。blob 以 JSON 内嵌，< 转义防 </script> 截断。 */
function renderViewer(blob, opts) {
  opts = opts || {};
  let tpl = fs.readFileSync(path.join(DIR, 'vault-viewer.template.html'), 'utf8');
  const json = JSON.stringify(blob).replace(/</g, '\\u003c');
  const rep = {
    '__PS_VAULT_BLOB__': json,
    '__PS_VAULT_NAME__': escapeHtml(blob.name || '加密文件'),
    '__PS_VAULT_BYTES__': String(blob.bytes || 0),
    '__PS_VAULT_DATE__': escapeHtml(opts.date || new Date().toISOString().slice(0, 10))
  };
  for (const k of Object.keys(rep)) tpl = tpl.split(k).join(rep[k]);
  return tpl;
}

/** 明文零泄漏断言：整文、整文 base64、长行抽样均不得出现在产物中。 */
function assertNoPlaintext(artifact, plain) {
  const leaks = [];
  if (plain && artifact.indexOf(plain) >= 0) leaks.push('整段原文');
  const b64 = Buffer.from(plain || '', 'utf8').toString('base64');
  if (b64 && artifact.indexOf(b64) >= 0) leaks.push('原文 base64 编码');
  const lines = String(plain || '').split(/\r?\n/).map(s => s.trim()).filter(s => s.length >= 12);
  const step = Math.max(1, Math.floor(lines.length / 20));
  const sample = lines.filter((_, i) => i % step === 0).slice(0, 20);
  for (const l of sample) {
    if (artifact.indexOf(l) >= 0) { leaks.push('抽样行命中（前 24 字符已截断）'); break; }
  }
  return { ok: leaks.length === 0, leaks: leaks, checkedLines: sample.length };
}

module.exports = {
  VERSION, ALG, ITER,
  generatePassphrase, sealText, openBlob, renderViewer, assertNoPlaintext
};
