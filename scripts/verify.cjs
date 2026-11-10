#!/usr/bin/env node
/* One-Click PC Privacy Shield - static self check.
   Checks structure, frontmatter, references, launcher, zero-delete assertions and JS syntax.
   Does not run GUI, network calls, or delete anything. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const ROOT = fs.existsSync(path.join(HERE, 'SKILL.md')) ? HERE : path.join(HERE, '..');
let pass = 0;
let fail = 0;

function ck(name, ok, extra) {
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  ok ? pass++ : fail++;
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

console.log('\n=== PC Privacy Shield self check ===');

const scripts = [
  'pc-shield.ps1', 'launch.cmd', 'verify.cjs', 'file-vault.cjs',
  'protect-file.cjs', 'vault-viewer.template.html', 'inject.cjs',
  'shield.web.js', 'shield.css', 'desktop-guard.cjs',
];
const refs = [
  'capability-boundaries.md', 'implementation.md',
  'command-reference.md', 'sharing-kit.md',
];

ck('SKILL.md', exists('SKILL.md'));
scripts.forEach((f) => ck('scripts/' + f, exists('scripts/' + f)));
refs.forEach((f) => ck('references/' + f, exists('references/' + f)));

const skill = read('SKILL.md');
function frontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== '---') return {};
  const end = lines.indexOf('---', 1);
  if (end < 0) return {};
  const obj = {};
  for (const line of lines.slice(1, end)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (m) obj[m[1]] = m[2].replace(/^(['"])([\s\S]*)\1$/, '$2');
  }
  return obj;
}
const fm = frontmatter(skill);
['name', 'display_name', 'display_name_en', 'description', 'description_zh', 'description_en', 'version', 'author']
  .forEach((k) => ck('frontmatter.' + k, Boolean(fm[k])));
ck('author is lilinshuei', fm.author === 'lilinshuei');
ck('version is present', /^\d+\.\d+\.\d+$/.test(fm.version || ''));
ck('@references used', refs.every((f) => skill.includes('@references/' + f)));
ck('zero-delete rule stated', skill.includes('不删除'));

const forbidden = ['C:' + '\\Users', 'C:' + '/Users', 'Admin' + 'istrator', '\u674e\u4e34\u6c34', 'Work' + 'Buddy', 'work' + 'buddy', '@qq' + '.com'];
const textFiles = ['SKILL.md', ...refs.map((f) => 'references/' + f), ...scripts.filter((f) => /\.(cjs|js|md|cmd|ps1|html|css)$/.test(f)).map((f) => 'scripts/' + f)];
const leaks = [];
for (const rel of textFiles) {
  if (!exists(rel)) continue;
  const text = read(rel);
  for (const token of forbidden) {
    if (text.includes(token)) leaks.push(rel + ':' + token);
  }
}
ck('no personal paths or names', leaks.length === 0, leaks.slice(0, 6).join(', '));

const forbiddenCalls = ['Remove-Item', 'File.Delete', 'Directory.Delete', 'RecycleOption', 'Move-Item', 'Rename-Item'];
const callFiles = ['pc-shield.ps1', 'launch.cmd', 'inject.cjs', 'file-vault.cjs', 'protect-file.cjs', 'desktop-guard.cjs'];
const calls = [];
for (const f of callFiles) {
  if (!exists('scripts/' + f)) continue;
  const text = read('scripts/' + f);
  for (const token of forbiddenCalls) if (text.includes(token)) calls.push(f + ':' + token);
}
ck('zero-delete assertions', calls.length === 0, calls.join(', '));

const launcher = read('scripts/launch.cmd');
ck('launcher is pure ASCII', [...launcher].every((ch) => ch.charCodeAt(0) < 128));
ck('launcher uses PC_SHIELD_DIR and PC_SHIELD_HOME',
  launcher.includes('PC_SHIELD_DIR') && launcher.includes('PC_SHIELD_HOME'));

for (const f of scripts.filter((x) => /\.(cjs|js)$/.test(x))) {
  let ok = true;
  let err = '';
  try {
    new vm.Script(read('scripts/' + f).replace(/^#![^\n]*\n/, ''), { filename: f });
  } catch (e) {
    ok = false;
    err = e.message;
  }
  ck('syntax ' + f, ok, err);
}

console.log('\n=== summary ===');
console.log('PASS=' + pass + '  FAIL=' + fail);
process.exit(fail > 0 ? 1 : 0);
