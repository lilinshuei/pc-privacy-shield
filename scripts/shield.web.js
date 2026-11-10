/* 一键插入隐私防护按钮 · L1 网页层运行时 v1.0.0
   零依赖、纯同步初始化、可离线。所有命名空间以 ps- / PrivacyShield 开头。
   诚实边界：本层只能主动遮蔽可见内容，无法阻止系统级远控截屏。 */
(function () {
  'use strict';
  var DEFAULTS = {
    mark: '仅供本人查看', hotkey: 'Ctrl+Alt+H', autoBlur: true,
    watermark: true, blockCopy: false, blockUpload: false,
    allow: [], position: 'bottom-right', level: 'L1-web'
  };
  var CFG = {}, k;
  for (k in DEFAULTS) CFG[k] = DEFAULTS[k];
  var ext = window.__PS_CONFIG__ || {};
  for (k in DEFAULTS) if (k in ext) CFG[k] = ext[k];

  var KEY = 'ps_cfg_v1', POSKEY = 'ps_fab_pos_v1';
  var S = {
    on: true, autoBlur: CFG.autoBlur, watermark: CFG.watermark,
    blockCopy: CFG.blockCopy, blockUpload: CFG.blockUpload,
    mark: CFG.mark, shield: false, blockedCount: 0
  };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') for (var sk in S) if (sk in saved && sk !== 'shield') S[sk] = saved[sk];
  } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  var $ = function (id) { return document.getElementById(id); };
  var fab, dot, shield, wm, panel, toast, wmTimer, dtTimer, drag = null;

  /* ---------- DOM ---------- */
  function build() {
    shield = document.createElement('div'); shield.id = 'psShield';
    shield.innerHTML =
      '<div class="ps-sh-inner">' +
      '<div class="ps-sh-ico">◼</div><div class="ps-sh-t">屏幕内容已遮蔽</div>' +
      '<div class="ps-sh-s">正文、图表与数据已隐藏。此时远程查看、截屏、录屏只能拍到这一层。</div>' +
      '<button type="button" class="ps-sh-btn" id="psRecover">点击恢复阅读</button> ' +
      '<button type="button" class="ps-sh-btn" id="psOpenSettings" style="background:#1b2740;color:#e8eef8;border-color:#2b3a52">打开设置</button>' +
      '<div class="ps-sh-k">快捷键 ' + esc(CFG.hotkey) + ' 切换遮蔽　·　Esc 恢复　·　单击悬浮球也可切换</div>' +
      '</div>';
    document.body.appendChild(shield);
    $('psRecover').onclick = recover;
    $('psOpenSettings').onclick = function () { recover(); openPanel(); };

    wm = document.createElement('div'); wm.id = 'psWatermark';
    document.body.appendChild(wm);

    fab = document.createElement('div'); fab.id = 'psFab';
    fab.setAttribute('role', 'button'); fab.setAttribute('aria-label', '隐私防护：单击遮蔽，双击设置');
    fab.title = '隐私防护 · 单击遮蔽 / 双击设置 / 可拖动';
    fab.innerHTML = '<span>⛨</span><i id="psDot"></i>';
    document.body.appendChild(fab);
    dot = $('psDot');
    placeFab();
    bindFab();

    panel = buildPanel();
    toast = document.createElement('div');
    toast.id = 'psToast';
    toast.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483645;' +
      'background:#1b2740;color:#e8eef8;border:1px solid #2b3a52;border-radius:9px;padding:8px 16px;' +
      'font:12px system-ui,sans-serif;opacity:0;pointer-events:none;transition:opacity .2s';
    document.body.appendChild(toast);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function say(msg) {
    if (!toast) return;
    toast.textContent = msg; toast.style.opacity = '1';
    clearTimeout(toast._t); toast._t = setTimeout(function () { toast.style.opacity = '0'; }, 1900);
  }

  /* ---------- 悬浮球：可拖动 + 单击遮蔽 + 双击/右键设置 ---------- */
  function placeFab() {
    var p = null;
    try { p = JSON.parse(localStorage.getItem(POSKEY) || 'null'); } catch (e) {}
    if (p && typeof p.left === 'number') {
      fab.style.left = p.left + 'px'; fab.style.top = p.top + 'px';
      fab.style.right = 'auto'; fab.style.bottom = 'auto'; return;
    }
    var pos = String(CFG.position || '').split('-');
    fab.style.top = pos[0] === 'top' ? '20px' : 'auto';
    fab.style.bottom = pos[0] === 'top' ? 'auto' : '20px';
    fab.style.left = pos[1] === 'left' ? '20px' : 'auto';
    fab.style.right = pos[1] === 'left' ? 'auto' : '20px';
  }
  function bindFab() {
    fab.addEventListener('pointerdown', function (e) {
      var r = fab.getBoundingClientRect();
      drag = { x: e.clientX, y: e.clientY, l: r.left, t: r.top, moved: false, id: e.pointerId };
      try { fab.setPointerCapture(e.pointerId); } catch (err) {}
    });
    fab.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
      if (!drag.moved) return;
      var w = fab.offsetWidth, h = fab.offsetHeight;
      var l = Math.max(0, Math.min(window.innerWidth - w, drag.l + dx));
      var t = Math.max(0, Math.min(window.innerHeight - h, drag.t + dy));
      fab.style.left = l + 'px'; fab.style.top = t + 'px';
      fab.style.right = 'auto'; fab.style.bottom = 'auto';
    });
    fab.addEventListener('pointerup', function (e) {
      if (!drag) return;
      var moved = drag.moved; drag = null;
      try { fab.releasePointerCapture(e.pointerId); } catch (err) {}
      if (moved) {
        try { localStorage.setItem(POSKEY, JSON.stringify({ left: parseFloat(fab.style.left), top: parseFloat(fab.style.top) })); } catch (err) {}
        return;
      }
      toggleShield();
    });
    fab.addEventListener('dblclick', function (e) { e.preventDefault(); openPanel(); });
    fab.addEventListener('contextmenu', function (e) { e.preventDefault(); openPanel(); });
  }

  /* ---------- 遮蔽 ---------- */
  function toggleShield() { S.shield ? recover() : doShield(); }
  function doShield() { S.shield = true; sync(); }
  function recover() { S.shield = false; sync(); }
  function sync() {
    shield.classList.toggle('on', !!S.shield);
    fab.classList.toggle('ps-on', !!S.shield);
    fab.classList.toggle('ps-alert', !!S.shield);
    dot.className = S.shield ? 'risk' : (S.on ? 'on' : '');
  }

  /* ---------- 水印 ---------- */
  function drawWatermark() {
    if (!wm) return;
    if (!(S.on && S.watermark)) { wm.style.display = 'none'; return; }
    wm.style.display = 'block';
    try {
      var c = document.createElement('canvas'); c.width = 360; c.height = 220;
      var x = c.getContext('2d');
      x.translate(180, 110); x.rotate(-Math.PI / 9);
      x.textAlign = 'center'; x.font = '13px system-ui,-apple-system,"Microsoft YaHei",sans-serif';
      x.fillStyle = 'rgba(190,205,230,.13)';
      var n = new Date(), p = function (v) { return String(v).padStart(2, '0'); };
      x.fillText(String(S.mark || '仅供本人查看').slice(0, 28), 0, 0);
      x.fillText(n.getFullYear() + '-' + p(n.getMonth() + 1) + '-' + p(n.getDate()) + ' ' + p(n.getHours()) + ':' + p(n.getMinutes()), 0, 20);
      wm.style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')';
      wm.style.backgroundSize = '360px 220px';
    } catch (e) {}
  }

  /* ---------- 设置面板 ---------- */
  function row(id, label, desc, checked) {
    return '<label class="ps-row"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '>' +
      '<span><b>' + label + '</b><em>' + desc + '</em></span></label>';
  }
  function buildPanel() {
    var d = document.createElement('div'); d.id = 'psPanel';
    d.innerHTML =
      '<div class="ps-p-head"><b>隐私防护 · 一键插入</b><button type="button" id="psClose" aria-label="关闭">×</button></div>' +
      '<div class="ps-p-body">' +
      row('psOn', '启用防护', '总开关。关闭后自动防护、水印、拦截全部停用；一键遮蔽仍可独立使用', S.on) +
      row('psAuto', '失焦自动遮蔽', '窗口失焦 / 切走标签 / 疑似调试面板时立刻盖住屏幕', S.autoBlur) +
      row('psWm', '动态水印', '铺满自定义标识与时间，截图后可追溯', S.watermark) +
      row('psCopy', '禁复制与右键', '拦复制、右键、选中、拖拽及 F12 / Ctrl+S-P-U（默认关，避免妨碍正常使用）', S.blockCopy) +
      row('psUpload', '外发请求白名单', '拦截非白名单的 fetch / XHR，减少数据经 VPN 或服务器外流（默认关，会挡宿主网络请求）', S.blockUpload) +
      '<label class="ps-row ps-mark"><span style="min-width:66px">水印文字</span><input type="text" id="psMark" maxlength="28"></label>' +
      '<div class="ps-actions">' +
      '<button type="button" class="ps-btn primary" id="psShieldNow">◼ 立即遮蔽</button>' +
      '<button type="button" class="ps-btn" id="psReport">能力自检</button></div>' +
      '<div class="ps-status" id="psStatus"></div>' +
      '<div class="ps-warn"><b>⚠ 能力边界（请如实了解，别对外说满）</b>' +
      '<table>' +
      '<tr><td>远控截屏（网页）</td><td>只能主动遮蔽，挡不住软件本身。网页沙箱看不见系统截屏</td></tr>' +
      '<tr><td>远控截屏（桌面）</td><td>需宿主为 Electron/Tauri 窗口并启用 L2 setContentProtection，可让窗口在截屏/录屏中变黑（非 100%，对注入式/驱动级截屏不保证）</td></tr>' +
      '<tr><td>VPN / 服务器</td><td>前端永远防不住。唯一有效的是数据不出本机 + 端到端加密，让抓到的也是密文</td></tr>' +
      '<tr><td>麦克风 / 摄像头</td><td>只能拦本页发起的调用，管不了系统设备或被别的程序占用</td></tr>' +
      '</table>本工具<b>不结束进程、不改注册表、不改系统设置</b>，所有检测只读。</div>' +
      '</div>';
    document.body.appendChild(d);
    $('psClose').onclick = function () { d.classList.remove('on'); };
    $('psShieldNow').onclick = function () { doShield(); d.classList.remove('on'); };
    $('psReport').onclick = function () { paintStatus(); say('已刷新能力自检'); };
    var map = { psOn: 'on', psAuto: 'autoBlur', psWm: 'watermark', psCopy: 'blockCopy', psUpload: 'blockUpload' };
    Object.keys(map).forEach(function (id) {
      var el = $(id);
      el.onchange = function () {
        S[map[id]] = el.checked; save();
        if (map[id] === 'blockUpload') installNetGuard();
        apply(); paintStatus();
      };
    });
    var mk = $('psMark'); mk.value = S.mark || '';
    mk.oninput = function () { S.mark = mk.value; save(); drawWatermark(); };
    return d;
  }
  function openPanel() { panel.classList.add('on'); paintStatus(); }
  function paintStatus() {
    var r = capabilityReport(), el = $('psStatus');
    if (!el) return;
    el.innerHTML = '<b>当前生效：' + r.level + ' 网页层</b><br>' +
      '真防系统级远控截屏：<b>' + (r.desktopProtection ? '是（L2 已启用）' : '否，需桌面层 L2') + '</b><br>' +
      '安全上下文 / WebCrypto：' + (r.secureContext ? '可用' : '不可用') + ' / ' + (r.webcrypto ? '可用' : '不可用') + '<br>' +
      '外发白名单阻断：' + (r.blockUpload ? '已开启（已拦 ' + r.blockedCount + ' 次）' : '关闭') + '<br>' +
      '页面环境：' + (r.fileProtocol ? '本地文件（离线）' : '网络页面') + (r.inIframe ? ' · 被嵌套' : '') + (r.automation ? ' · 自动化环境' : '');
  }

  /* ---------- 拦截层 ---------- */
  function bindGuards() {
    function on(name, fn) { document.addEventListener(name, fn, true); }
    on('contextmenu', function (e) {
      if (e.target === fab || (e.target.closest && e.target.closest('#psFab'))) return;
      if (S.on && S.blockCopy) e.preventDefault();
    });
    ['copy', 'cut', 'selectstart', 'dragstart'].forEach(function (n) {
      on(n, function (e) {
        if (e.target.closest && e.target.closest('#psPanel')) return;
        if (S.on && S.blockCopy) e.preventDefault();
      });
    });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && S.shield) { recover(); return; }
      if (e.ctrlKey && e.altKey && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); toggleShield(); return; }
      if (!(S.on && S.blockCopy)) return;
      var key = String(e.key || '').toLowerCase();
      if (e.key === 'F12' || (e.ctrlKey && (key === 's' || key === 'u' || key === 'p')) ||
        (e.ctrlKey && e.shiftKey && (key === 'i' || key === 'j' || key === 'c'))) e.preventDefault();
    }, true);

    window.addEventListener('blur', function () { if (S.on && S.autoBlur) doShield(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && S.on && S.autoBlur) doShield(); });
    dtTimer = setInterval(function () {
      if (!(S.on && S.autoBlur)) return;
      if (window.outerWidth - window.innerWidth > 170 || window.outerHeight - window.innerHeight > 170) doShield();
    }, 1600);

    /* 屏幕共享 / 摄像头：只能检测本页发起的调用，管不了系统级设备 */
    try {
      var md = navigator.mediaDevices;
      if (md) {
        [['getDisplayMedia', '检测到屏幕共享调用'], ['getUserMedia', '检测到摄像头/麦克风调用']].forEach(function (pair) {
          if (!md[pair[0]]) return;
          var orig = md[pair[0]].bind(md);
          md[pair[0]] = function () {
            if (S.on) { doShield(); say(pair[1] + '，已自动遮蔽'); }
            return orig.apply(md, arguments);
          };
        });
      }
    } catch (e) {}
  }

  /* ---------- L3：外发请求白名单（默认关） ---------- */
  var netInstalled = false, origFetch = null, origXHROpen = null;
  function allowed(url) {
    var u = String(url || '');
    if (/^(\/|\.\/|\.\.\/|\?|#)/.test(u)) return true;
    if (/^(blob:|data:|file:)/i.test(u)) return true;
    try {
      var p = new URL(u, location.href);
      if (p.host === location.host) return true;
      var list = Array.isArray(CFG.allow) ? CFG.allow : String(CFG.allow || '').split(',');
      for (var i = 0; i < list.length; i++) {
        var h = String(list[i]).trim().toLowerCase();
        if (h && (p.hostname === h || p.hostname.indexOf('.' + h) > 0 || p.host === h)) return true;
      }
    } catch (e) { return true; }
    return false;
  }
  function blocked(url) { S.blockedCount++; say('已阻断外发：' + String(url).slice(0, 48)); }
  function installNetGuard() {
    if (!S.blockUpload) return;
    if (netInstalled) return;
    netInstalled = true;
    try {
      if (window.fetch) {
        origFetch = window.fetch;
        window.fetch = function (input, init) {
          if (!S.blockUpload) return origFetch.apply(window, arguments);
          var u = typeof input === 'string' ? input : (input && input.url) || '';
          if (!allowed(u)) { blocked(u); return Promise.reject(new Error('[PrivacyShield] 外发已阻断')); }
          return origFetch.apply(window, arguments);
        };
      }
      if (window.XMLHttpRequest && XMLHttpRequest.prototype.open) {
        origXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url) {
          if (!S.blockUpload) return origXHROpen.apply(this, arguments);
          if (!allowed(url)) { blocked(url); throw new Error('[PrivacyShield] 外发已阻断'); }
          return origXHROpen.apply(this, arguments);
        };
      }
    } catch (e) {}
  }

  /* ---------- L3：端到端加密（WebCrypto AES-GCM + PBKDF2） ---------- */
  function b64(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function derive(pass, salt) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']).then(function (km) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 150000, hash: 'SHA-256' },
        km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function seal(data, passphrase) {
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error('WebCrypto 不可用（需安全上下文）'));
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var plain = new TextEncoder().encode(typeof data === 'string' ? data : JSON.stringify(data));
    return derive(passphrase, salt).then(function (key) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plain);
    }).then(function (ct) {
      return { v: 1, alg: 'AES-GCM/PBKDF2-SHA256/150000', salt: b64(salt), iv: b64(iv), data: b64(ct) };
    });
  }
  function open(blob, passphrase) {
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error('WebCrypto 不可用'));
    return derive(passphrase, unb64(blob.salt)).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.data));
    }).then(function (buf) { return new TextDecoder().decode(buf); });
  }

  /* ---------- 能力报告 / 状态应用 ---------- */
  function capabilityReport() {
    var inFrame = false;
    try { inFrame = window.top !== window.self; } catch (e) { inFrame = true; }
    return {
      version: '1.0.0',
      level: CFG.level,
      desktopProtection: false,          /* 网页层永远为 false；L2 由 desktop-guard 提供 */
      canBlockSystemCapture: false,      /* 不虚构：网页层不能阻止系统级截屏 */
      shieldActive: S.shield,
      enabled: S.on,
      autoBlur: S.autoBlur,
      watermark: S.watermark,
      blockCopy: S.blockCopy,
      blockUpload: S.blockUpload,
      blockedCount: S.blockedCount,
      secureContext: !!window.isSecureContext,
      webcrypto: !!(window.crypto && crypto.subtle),
      fileProtocol: location.protocol === 'file:',
      inIframe: inFrame,
      automation: !!navigator.webdriver,
      note: 'L1 网页层只能主动遮蔽；真防远控截屏需 L2 桌面层 setContentProtection；VPN/服务器抓取前端无解，靠零上传+加密。'
    };
  }
  function apply() {
    drawWatermark();
    sync();
  }

  /* ---------- 启动 ---------- */
  build();
  bindGuards();
  if (S.blockUpload) installNetGuard();
  apply();
  wmTimer = setInterval(drawWatermark, 60000);

  window.PrivacyShield = {
    version: '1.0.0',
    shield: doShield,
    recover: recover,
    toggle: toggleShield,
    panel: openPanel,
    state: function () { return capabilityReport(); },
    capabilityReport: capabilityReport,
    setOption: function (key, val) {
      if (key in S) { S[key] = val; save(); if (key === 'blockUpload') installNetGuard(); apply(); return true; }
      return false;
    },
    seal: seal,
    open: open
  };
})();
