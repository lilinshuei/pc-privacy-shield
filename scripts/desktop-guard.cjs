#!/usr/bin/env node
/* 一键插入隐私防护按钮 · L2 桌面层守卫 v1.0.0
   真正让窗口在远控截屏/录屏里变黑：Electron BrowserWindow.setContentProtection(true)
     Windows → WDA_EXCLUDEFROMCAPTURE (Win10 2004+)
     macOS   → NSWindowSharingNone
   只读检测远控进程与 VPN 适配器；不结束进程、不改注册表、不改系统设置、不装驱动。
   凭据隔离：只取进程名，绝不读取命令行参数；不持久化、不写日志到包内。 */
'use strict';
const { execFileSync } = require('child_process');

/* 常见远控/远程桌面客户端进程名（只匹配名字，不取命令行） */
const REMOTE_PROCESS = [
  /sunlogin/i, /awesun/i, /向日葵/i, /todesk/i, /teamviewer/i,
  /anydesk/i, /rustdesk/i, /splashtop/i, /ultraviewer/i, /anyviewer/i,
  /parsec/i, /raylink/i, /mstsc/i, /vncviewer/i, /chrome_remote_desktop/i
];
const VPN_ADAPTER = /tap|tun|wireguard|openvpn|vpn|ppp|l2tp|ikev2|clash|wintun|zerotier|tailscale|sstap/i;

function readProcessNames() {
  if (process.platform !== 'win32') return [];
  try {
    const out = execFileSync('tasklist', ['/FO', 'CSV', '/NH'],
      { encoding: 'utf8', timeout: 6000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    return out.split(/\r?\n/).map(function (line) {
      const m = line.match(/^"?([^",]+)"?/);
      return m ? m[1].trim() : '';
    }).filter(Boolean);
  } catch (e) { return []; }
}

/** 只读：检测常见远控客户端是否正在运行。返回进程名，不含命令行。 */
function detectRemoteProcesses() {
  if (process.platform !== 'win32') return { platform: process.platform, found: false, names: [], note: '当前平台未实现进程枚举' };
  const names = readProcessNames();
  const hit = names.filter(n => REMOTE_PROCESS.some(re => re.test(n)));
  return { platform: process.platform, found: hit.length > 0, names: Array.from(new Set(hit)) };
}

/** 只读：检测常见 VPN 虚拟网卡。仅作风险提示，检测到 ≠ 能防 VPN。 */
function detectVpnAdapters() {
  if (process.platform !== 'win32') return { platform: process.platform, found: false, adapters: [] };
  try {
    const out = execFileSync('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', 'Get-NetAdapter | Select-Object -ExpandProperty Name'],
      { encoding: 'utf8', timeout: 9000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    const all = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const hit = all.filter(n => VPN_ADAPTER.test(n));
    return { platform: process.platform, found: hit.length > 0, adapters: hit };
  } catch (e) {
    return { platform: process.platform, found: false, adapters: [], note: '适配器枚举不可用（权限或系统版本限制）' };
  }
}

/** 核心：让窗口内容在截屏/录屏/远控中变黑。只对 Electron 原生窗口有效。 */
function setContentProtection(win, on) {
  if (!win || typeof win.setContentProtection !== 'function') {
    return { ok: false, enabled: false, reason: '窗口对象不支持 setContentProtection（需 Electron BrowserWindow；网页层无法调用系统 API）' };
  }
  try {
    win.setContentProtection(!!on);
    return { ok: true, enabled: !!on, api: 'Electron BrowserWindow.setContentProtection' };
  } catch (e) {
    return { ok: false, enabled: false, reason: e.message };
  }
}

/** 轮询：一旦检测到远控进程就自动开启窗口黑屏保护；返回停止函数。 */
function watchAndAutoProtect(win, opts) {
  opts = opts || {};
  const ms = Math.max(1000, opts.intervalMs || 5000);
  let wasFound = false;
  function tick() {
    const r = detectRemoteProcesses();
    if (r.found && !wasFound) {
      const p = setContentProtection(win, true);
      if (opts.onDetect) opts.onDetect({ reason: '检测到远控进程', names: r.names, protection: p });
    }
    wasFound = r.found;
  }
  tick();
  const timer = setInterval(tick, ms);
  if (timer.unref) timer.unref();
  return function stop() { clearInterval(timer); };
}

/** 便捷入口：Electron 主进程里 mainWindow 创建后调用一次即可。 */
function applyToElectron(win, opts) {
  opts = opts || {};
  const report = capabilityReport();
  const protection = setContentProtection(win, opts.enable !== false);
  const res = { version: '1.0.0', platform: report.platform, protection: protection, autoWatch: false, report: report };
  if (opts.autoOnRemote) {
    watchAndAutoProtect(win, { intervalMs: opts.intervalMs, onDetect: opts.onDetect });
    res.autoWatch = true;
  }
  return res;
}

/** 能力报告：只报实际可用的能力，不因「模块被 require」就宣称已防护。 */
function capabilityReport() {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  return {
    version: '1.0.0',
    level: 'L2-desktop',
    platform: process.platform,
    setContentProtectionSupported: isWin || isMac,
    windowsBlackout: isWin,
    macosBlackout: isMac,
    canBlockSystemCapture: isWin || isMac,
    remoteProcessDetection: isWin,
    vpnAdapterDetection: isWin,
    limits: [
      '只保护本应用窗口，不保护整个桌面或其他程序窗口',
      '对注入式、驱动级、或「先截整屏再裁剪」的方案不保证',
      '对已建立的远控会话，一般需要重新创建窗口才生效',
      'Windows 需 10 2004（build 19041）及以上',
      '对 VPN 中间人与服务器侧抓取完全无效：那要靠零上传 + 端到端加密',
      '不结束进程、不改注册表、不改系统设置、不装驱动；进程检测只读且不含命令行'
    ],
    honestNote: 'L2 是唯一能「真防一大半远控截屏」的层，但不是 100%，且必须由桌面宿主主动调用 applyToElectron 才生效。'
  };
}

module.exports = {
  version: '1.0.0',
  setContentProtection: setContentProtection,
  detectRemoteProcesses: detectRemoteProcesses,
  detectVpnAdapters: detectVpnAdapters,
  watchAndAutoProtect: watchAndAutoProtect,
  applyToElectron: applyToElectron,
  capabilityReport: capabilityReport,
  REMOTE_PROCESS: REMOTE_PROCESS
};
