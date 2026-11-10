#requires -Version 5.1
<#
  一键PC隐私防护 · pc-shield.ps1  v2.1.0
  零依赖（Windows PowerShell 5.1 + .NET Framework WinForms），离线运行。

  目标：本人屏幕正常看内容；截屏 / 录屏 / 远控 / 屏幕共享的画面里该窗口是黑的。
        零遮挡、零手动「防护」开关、无密码、原文件默认只读不改。

  机制：SetWindowDisplayAffinity(hWnd, WDA_EXCLUDEFROMCAPTURE=0x11) + 读回校验。
        MSDN 要求窗口属于当前进程，因此启动时自动实测：
          模式 A：对标题含 -TargetPattern 的第三方窗口设置成功 → 不新建任何窗口。
          模式 B：失败 → 立即恢复原值，自动创建本程序自己的查看器窗口并设置 WDA。
        WDA 只影响「给别人看的画面合成」，不拦截键盘输入，因此查看器可以正常编辑。

  v2.1.0 新增：查看器「可修改 / 禁止修改」开关（默认可修改，可用 -StartReadOnly 反转）。
        可修改时允许正常输入新文字与修改；Ctrl+S / 底部「保存」按钮 / 托盘项
        显式写回原文件。写回前自动备份到 %APPDATA%\PCPrivacyShield\backups\，
        并保持原文件编码（UTF-8 有无 BOM / 系统 ANSI）与换行风格（CRLF / LF / CR）不变。
        不点保存，原文件一字不动；关闭时有未保存改动会提示。

  纪律：不删除、不移入回收站、不移动、不重命名任何文件；
        不联网、不写明文副本、不改注册表、不改文件关联、不改系统设置、不装驱动；
        退出时把所有被改动窗口的 affinity 恢复原值。
#>
param(
  [string]$Source = '',              # 明文源文件精确路径（优先）
  [string]$SourceDir = '',           # 未给 Source 时在此目录找 *.txt
  [string]$TargetPattern = '密码本',  # 模式 A 探测用的窗口标题匹配串
  [switch]$NoForeignProbe,           # 跳过跨进程探测，直接建自己的窗口
  [switch]$NoReport,                 # 不写诊断报告
  [switch]$StartReadOnly             # 启动时默认「禁止修改」（默认是可修改）
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class PcShieldWin32 {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool SetWindowDisplayAffinity(IntPtr h, uint a);
  [DllImport("user32.dll")] public static extern bool GetWindowDisplayAffinity(IntPtr h, out uint a);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int n, int v);
  [DllImport("user32.dll")] public static extern bool SetLayeredWindowAttributes(IntPtr h, uint key, byte alpha, uint flags);

  public static IntPtr[] Find(string needle) {
    List<IntPtr> l = new List<IntPtr>();
    EnumProc cb = delegate(IntPtr h, IntPtr p) {
      if (!IsWindowVisible(h)) return true;
      StringBuilder sb = new StringBuilder(512);
      GetWindowText(h, sb, 512);
      if (sb.ToString().IndexOf(needle, StringComparison.OrdinalIgnoreCase) >= 0) l.Add(h);
      return true;
    };
    EnumWindows(cb, IntPtr.Zero);
    return l.ToArray();
  }
  public static uint Read(IntPtr h) { uint a; return GetWindowDisplayAffinity(h, out a) ? a : 0xFFFFFFFF; }
  public static void ClickThrough(IntPtr h) {
    int ex = GetWindowLong(h, -20);
    SetWindowLong(h, -20, ex | 0x20 | 0x80000);
    SetLayeredWindowAttributes(h, 0, 255, 0x02);
  }
}
'@

$EXCLUDE = [uint32]0x11
$NONE = [uint32]0x00
$script:changed = @{}            # hwnd -> 原始 affinity
$script:mode = 'B-own-viewer'
$script:cover = $null
$script:form = $null
$script:tb = $null
$script:bar = $null
$script:btnEdit = $null
$script:btnSave = $null
$script:wdaSelfOK = $false
$script:wdaSelfRead = 0xFFFFFFFF
$script:editable = -not $StartReadOnly
$script:dirty = $false
$script:saveCount = 0
$script:srcEnc = 'UTF8'
$script:srcBOM = $false
$script:srcNewline = "`r`n"
$script:backupDir = Join-Path $env:APPDATA 'PCPrivacyShield\backups'

$aboutText = @'
一键PC隐私防护 v2.1.0 · 原理与能力边界（如实说明，不夸大）

原理：
  对窗口调用 SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)，
  让 Windows 在「截屏 / 录屏 / 远控 / 屏幕共享」的合成画面里把该窗口涂黑，
  而本机屏幕正常显示。零遮挡、无需手动开关、无密码。

编辑开关（v2.1.0）：
  WDA 只管「别人拍到的画面」，不拦截键盘输入，所以查看器可以正常打字与修改。
  · 默认「可修改」：可正常输入新文字、修改内容。
  · 点底部按钮 / 托盘项 / Ctrl+E，可切到「禁止修改」（纯只读）。
  · 改动不会自动写盘。按 Ctrl+S 或点「保存」才写回原文件。
  · 写回前自动备份到 %APPDATA%\PCPrivacyShield\backups\，
    并保持原文件编码（UTF-8 有无 BOM / 系统 ANSI）与换行（CRLF / LF / CR）不变。
  · 不点保存就退出，原文件一字不动；有未保存改动时关闭会提示。

能防：
  DXGI 桌面复制、系统截屏、向日葵 / ToDesk / TeamViewer 等远控画面、
  Teams / Zoom 等屏幕共享。

不能保证：
  · 注入式截屏（进程内 hook DWM）、驱动级捕获；
  · 已建立的远控会话通常要重建窗口才生效；
  · 不防键盘记录、麦克风 / 摄像头，不防别人直接站在你身后看屏幕；
  · 原文件仍是明文：不防文件被复制、被云同步、被已入侵本机的程序读取。
    需要真正「防拿走」请用同目录的 protect-file.cjs 做本地加密。

应急兜底：
  托盘「强制遮蔽 / 恢复」会用一块不透明遮板只盖住本查看器窗口（鼠标可穿透，
  不挡其他窗口）。WDA 挡不住的截屏手段，用它能挡住，代价是屏幕上看得见黑块。

硬限制：
  WDA 按 MSDN 只作用于「属于当前进程」的窗口。本程序启动时会实测能否对第三方
  窗口设置：成功走模式 A（直接保护记事本窗口，此时请直接在记事本里编辑保存），
  失败走模式 B（自建查看器，编辑开关在模式 B 生效）。
  结果写入 %APPDATA%\PCPrivacyShield\report.json，不含任何明文。

纪律：不删除任何文件、不联网、不改注册表 / 文件关联 / 系统设置；
      不主动写盘，仅在你显式保存时写回原文件；保存前的自动备份是明文副本，
      位于 %APPDATA%\PCPrivacyShield\backups\，与原件同等敏感；
      退出时恢复所有被改动窗口的 affinity。
'@

# ---------------- 源文件定位与格式探测（只读） ----------------
function Resolve-Source {
  if ($Source -and (Test-Path -LiteralPath $Source)) { return (Get-Item -LiteralPath $Source).FullName }
  $dir = $SourceDir
  if (-not $dir) { $dir = $env:PC_SHIELD_DIR }
  if ($dir -and (Test-Path -LiteralPath $dir)) {
    $c = @(Get-ChildItem -LiteralPath $dir -Filter '*.txt' -File -ErrorAction SilentlyContinue)
    $pref = $c | Where-Object { $_.Name -like "*$TargetPattern*" } | Select-Object -First 1
    if ($pref) { return $pref.FullName }
    if ($c.Count -gt 0) { return $c[0].FullName }
  }
  return ''
}

function Probe-Source {
  # 探测原文件的编码与换行风格，确保保存后格式不变
  if (-not $script:srcPath) { return }
  try {
    $bytes = [System.IO.File]::ReadAllBytes($script:srcPath)
    $script:srcBOM = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
  } catch { $script:srcBOM = $false }
  try {
    $strict = [System.Text.UTF8Encoding]::new($false, $true)
    $script:content = [System.IO.File]::ReadAllText($script:srcPath, $strict)
    $script:srcEnc = 'UTF8'
  } catch {
    $script:content = [System.IO.File]::ReadAllText($script:srcPath, [System.Text.Encoding]::Default)
    $script:srcEnc = 'ANSI'
  }
  if ($script:content.Contains("`r`n")) { $script:srcNewline = "`r`n" }
  elseif ($script:content.Contains("`n")) { $script:srcNewline = "`n" }
  elseif ($script:content.Contains("`r")) { $script:srcNewline = "`r" }
  else { $script:srcNewline = "`r`n" }
}

function Read-Source {
  if (-not $script:srcPath) { return '' }
  try {
    if ($script:srcEnc -eq 'UTF8') {
      return [System.IO.File]::ReadAllText($script:srcPath, [System.Text.UTF8Encoding]::new($false, $true))
    }
    return [System.IO.File]::ReadAllText($script:srcPath, [System.Text.Encoding]::Default)
  } catch { return $script:content }
}

$script:srcPath = Resolve-Source
$script:content = ''
Probe-Source

# ---------------- 模式 A：跨进程 WDA 实测 ----------------
$probeFound = 0
$probeFailed = 0
if (-not $NoForeignProbe) {
  $hs = @()
  try { $hs = @([PcShieldWin32]::Find($TargetPattern)) } catch {}
  $probeFound = $hs.Count
  foreach ($h in $hs) {
    if ($h -eq [IntPtr]::Zero) { continue }
    $before = [PcShieldWin32]::Read($h)
    $ok = $false
    try { $ok = [PcShieldWin32]::SetWindowDisplayAffinity($h, $EXCLUDE) } catch {}
    $after = [PcShieldWin32]::Read($h)
    if ($ok -and $after -eq $EXCLUDE) {
      $script:changed[[string]$h] = @{ h = $h; before = $before }
    } else {
      $probeFailed++
      try { [PcShieldWin32]::SetWindowDisplayAffinity($h, $before) | Out-Null } catch {}
    }
  }
}
if ($script:changed.Count -gt 0) { $script:mode = 'A-foreign-window' }

# ---------------- 编辑 / 保存 / 状态栏 ----------------
function Update-Bar {
  if ($null -eq $script:bar) { return }
  $st = if ($script:wdaSelfRead -eq $EXCLUDE) { 'WDA=EXCLUDE_FROM_CAPTURE · 截屏/远控中本窗口为黑' }
        elseif ($script:wdaSelfOK) { 'WDA 已设置（读回校验中）' }
        else { 'WDA 设置失败 · 请看「原理与能力边界」' }
  $name = if ($script:srcPath) { Split-Path $script:srcPath -Leaf } else { '(未找到源文件)' }
  $bytes = if ($script:srcPath) { (Get-Item -LiteralPath $script:srcPath).Length } else { 0 }
  $state = if ($script:editable) { '可修改' } else { '禁止修改' }
  $flag = if ($script:dirty) { ' · 未保存' } else { '' }
  $script:bar.Text = '  ' + $st + '  |  ' + $name + '  |  ' + $bytes + ' 字节  |  ' + $state + $flag
  if ($null -ne $script:btnEdit) { $script:btnEdit.Text = $state }
  if ($null -ne $script:btnSave) { $script:btnSave.Enabled = $script:dirty }
}

function Toggle-Edit {
  if ($null -eq $script:form) {
    [System.Windows.Forms.MessageBox]::Show(
      '当前为模式 A：已直接保护记事本等第三方窗口，请在记事本里正常编辑与保存。' + "`r`n" +
      '「可修改 / 禁止修改」开关仅在本程序自建的防护查看器（模式 B）中生效。',
      '编辑开关', [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
    return
  }
  $script:editable = -not $script:editable
  if ($null -ne $script:tb) { $script:tb.ReadOnly = (-not $script:editable) }
  Update-Bar
  Write-Report
  $msg = if ($script:editable) { '已切换为「可修改」：可正常输入与修改，Ctrl+S 或点「保存」写回原文件' }
         else { '已切换为「禁止修改」：纯只读，不会改动原文件' }
  if ($null -ne $script:notify) {
    $script:notify.ShowBalloonTip(1600, '编辑开关', $msg, [System.Windows.Forms.ToolTipIcon]::Info)
  }
}

function Save-Changes {
  if (-not $script:srcPath -or $null -eq $script:tb) {
    [System.Windows.Forms.MessageBox]::Show('未找到源文件或查看器，无法保存。', '一键PC隐私防护',
      [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
    return $false
  }
  try {
    # 规范化换行：先统一为 LF，再按探测到的原文件风格还原
    $text = $script:tb.Text.Replace("`r`n", "`n").Replace("`r", "`n")
    $text = $text.Replace("`n", $script:srcNewline)

    # 先备份（新增文件，不删除、不移动、不重命名任何现有文件）
    if (-not (Test-Path -LiteralPath $script:backupDir)) {
      New-Item -ItemType Directory -Path $script:backupDir -Force | Out-Null
    }
    $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
    $bak = Join-Path $script:backupDir ((Split-Path $script:srcPath -Leaf) + '.' + $stamp + '.bak')
    Copy-Item -LiteralPath $script:srcPath -Destination $bak -Force

    # 按原编码写回：UTF-8（BOM 状态与原件一致）或系统 ANSI
    $enc = if ($script:srcEnc -eq 'UTF8') {
      [System.Text.UTF8Encoding]::new($script:srcBOM)
    } else {
      [System.Text.Encoding]::Default
    }
    [System.IO.File]::WriteAllText($script:srcPath, $text, $enc)

    $script:content = $text
    $script:dirty = $false
    $script:saveCount++
    Update-Bar
    Write-Report
    return $true
  } catch {
    [System.Windows.Forms.MessageBox]::Show('保存失败：' + $_.Exception.Message, '一键PC隐私防护',
      [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
    return $false
  }
}

# ---------------- 模式 B：自建查看器 ----------------
if ($script:mode -eq 'B-own-viewer') {
  $f = New-Object System.Windows.Forms.Form
  $f.Text = '一键PC隐私防护 · 防护查看器'
  $f.Size = New-Object System.Drawing.Size(900, 640)
  $f.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
  $f.BackColor = [System.Drawing.Color]::FromArgb(13, 20, 32)
  $f.MinimumSize = New-Object System.Drawing.Size(520, 360)
  $f.KeyPreview = $true

  $tb = New-Object System.Windows.Forms.TextBox
  $tb.Multiline = $true
  $tb.ReadOnly = (-not $script:editable)
  $tb.WordWrap = $false
  $tb.ScrollBars = [System.Windows.Forms.ScrollBars]::Both
  $tb.Dock = [System.Windows.Forms.DockStyle]::Fill
  $tb.Font = New-Object System.Drawing.Font('Consolas', 11)
  $tb.BackColor = [System.Drawing.Color]::FromArgb(14, 24, 41)
  $tb.ForeColor = [System.Drawing.Color]::FromArgb(220, 231, 247)
  $tb.BorderStyle = [System.Windows.Forms.BorderStyle]::None
  $f.Controls.Add($tb)
  $script:tb = $tb

  $panel = New-Object System.Windows.Forms.Panel
  $panel.Dock = [System.Windows.Forms.DockStyle]::Bottom
  $panel.Height = 32
  $panel.BackColor = [System.Drawing.Color]::FromArgb(21, 33, 54)

  $bar = New-Object System.Windows.Forms.Label
  $bar.Dock = [System.Windows.Forms.DockStyle]::Fill
  $bar.TextAlign = [System.Drawing.ContentAlignment]::MiddleLeft
  $bar.ForeColor = [System.Drawing.Color]::FromArgb(255, 212, 121)
  $bar.BackColor = [System.Drawing.Color]::FromArgb(21, 33, 54)
  $bar.Font = New-Object System.Drawing.Font('Microsoft YaHei', 9)
  $panel.Controls.Add($bar)
  $script:bar = $bar

  $btnSave = New-Object System.Windows.Forms.Button
  $btnSave.Dock = [System.Windows.Forms.DockStyle]::Right
  $btnSave.Width = 84
  $btnSave.Text = '保存'
  $btnSave.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
  $btnSave.BackColor = [System.Drawing.Color]::FromArgb(32, 52, 82)
  $btnSave.ForeColor = [System.Drawing.Color]::FromArgb(220, 231, 247)
  $btnSave.FlatAppearance.BorderSize = 0
  $btnSave.Enabled = $false
  $btnSave.Font = New-Object System.Drawing.Font('Microsoft YaHei', 9)
  $panel.Controls.Add($btnSave)
  $script:btnSave = $btnSave

  $btnEdit = New-Object System.Windows.Forms.Button
  $btnEdit.Dock = [System.Windows.Forms.DockStyle]::Right
  $btnEdit.Width = 108
  $btnEdit.Text = if ($script:editable) { '可修改' } else { '禁止修改' }
  $btnEdit.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
  $btnEdit.BackColor = [System.Drawing.Color]::FromArgb(46, 72, 108)
  $btnEdit.ForeColor = [System.Drawing.Color]::FromArgb(255, 236, 190)
  $btnEdit.FlatAppearance.BorderSize = 0
  $btnEdit.Font = New-Object System.Drawing.Font('Microsoft YaHei', 9)
  $panel.Controls.Add($btnEdit)
  $script:btnEdit = $btnEdit

  $f.Controls.Add($panel)
  $script:form = $f

  $tip = New-Object System.Windows.Forms.ToolTip
  $tip.SetToolTip($btnEdit, '点击切换「可修改 / 禁止修改」（Ctrl+E）')
  $tip.SetToolTip($btnSave, '把修改写回原文件（Ctrl+S）：自动保持原编码与换行，并先备份')

  # 初始化文本后再挂事件，避免初始赋值被误判为「未保存」
  $tb.Text = $script:content
  $tb.Add_TextChanged({
    if ($script:editable) { $script:dirty = $true; Update-Bar }
  })
  $btnEdit.Add_Click({ Toggle-Edit })
  $btnSave.Add_Click({ Save-Changes | Out-Null })

  $f.Add_KeyDown({
    if ($_.Control -and $_.KeyCode -eq [System.Windows.Forms.Keys]::E) {
      Toggle-Edit; $_.SuppressKeyPress = $true
    } elseif ($_.Control -and $_.KeyCode -eq [System.Windows.Forms.Keys]::S) {
      Save-Changes | Out-Null; $_.SuppressKeyPress = $true
    }
  })

  $f.Add_FormClosing({
    if (-not $script:dirty) { return }
    $r = [System.Windows.Forms.MessageBox]::Show(
      '有未保存的修改。是否保存回原文件？', '一键PC隐私防护',
      [System.Windows.Forms.MessageBoxButtons]::YesNoCancel,
      [System.Windows.Forms.MessageBoxIcon]::Question)
    if ($r -eq [System.Windows.Forms.DialogResult]::Yes) {
      if (-not (Save-Changes)) { $_.Cancel = $true }
    } elseif ($r -eq [System.Windows.Forms.DialogResult]::Cancel) {
      $_.Cancel = $true
    }
  })

  $f.Add_Shown({
    try { $script:wdaSelfOK = [PcShieldWin32]::SetWindowDisplayAffinity($script:form.Handle, $EXCLUDE) } catch {}
    $script:wdaSelfRead = [PcShieldWin32]::Read($script:form.Handle)
    $script:changed[[string]$script:form.Handle] = @{ h = $script:form.Handle; before = $NONE }
    Update-Bar
    Write-Report
  })
}

# ---------------- 强制遮蔽兜底（只盖本窗口，鼠标穿透） ----------------
function Toggle-Cover {
  if ($null -ne $script:cover) {
    try { $script:cover.Close(); $script:cover.Dispose() } catch {}
    $script:cover = $null
    return
  }
  if ($null -eq $script:form) { return }
  $c = New-Object System.Windows.Forms.Form
  $c.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
  $c.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
  $c.Bounds = $script:form.Bounds
  $c.BackColor = [System.Drawing.Color]::FromArgb(11, 16, 24)
  $c.TopMost = $true
  $c.ShowInTaskbar = $false
  $c.Text = 'PC-SHIELD-COVER'
  $c.Show()
  try { [PcShieldWin32]::ClickThrough($c.Handle) } catch {}
  $script:cover = $c
}

# ---------------- 诊断报告（不含明文） ----------------
function Write-Report {
  if ($NoReport) { return }
  try {
    $dir = Join-Path $env:APPDATA 'PCPrivacyShield'
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $nlName = if ($script:srcNewline -eq "`r`n") { 'CRLF' } elseif ($script:srcNewline -eq "`n") { 'LF' } else { 'CR' }
    $r = [ordered]@{
      version           = '2.1.0'
      skill             = '一键PC隐私防护'
      time              = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
      mode              = $script:mode
      osBuild           = [Environment]::OSVersion.Version.ToString()
      foreignProbeFound = $probeFound
      foreignProbeFailed= $probeFailed
      foreignProtected  = $script:changed.Count
      wdaSelfSet        = $script:wdaSelfOK
      wdaSelfRead       = ('0x{0:X2}' -f $script:wdaSelfRead)
      editable          = $script:editable
      dirty             = $script:dirty
      saveCount         = $script:saveCount
      source            = $script:srcPath
      sourceBytes       = if ($script:srcPath) { (Get-Item -LiteralPath $script:srcPath).Length } else { 0 }
      sourceEncoding    = $script:srcEnc
      sourceBOM         = $script:srcBOM
      sourceNewline     = $nlName
      containsPlaintext = $false
      note              = 'Reports contain no plaintext. Saving is explicit and keeps the original encoding and line endings.'
    }
    $r | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dir 'report.json') -Encoding UTF8 -Force
  } catch {}
}

# ---------------- 托盘 ----------------
$script:notify = New-Object System.Windows.Forms.NotifyIcon
$script:notify.Icon = [System.Drawing.SystemIcons]::Shield
$script:notify.Text = '一键PC隐私防护'
$script:notify.Visible = $true
$menu = New-Object System.Windows.Forms.ContextMenuStrip

$miEdit = $menu.Items.Add('可修改 / 禁止修改（切换，Ctrl+E）')
$miEdit.Add_Click({ Toggle-Edit })

$miSave = $menu.Items.Add('保存修改到原文件（Ctrl+S）')
$miSave.Add_Click({ Save-Changes | Out-Null })

$miCover = $menu.Items.Add('强制遮蔽 / 恢复（应急，对抗注入式截屏）')
$miCover.Add_Click({ Toggle-Cover })

$miWda = $menu.Items.Add('关闭 / 开启 WDA（自己要截图时用）')
$script:wdaOff = $false
$miWda.Add_Click({
  $script:wdaOff = -not $script:wdaOff
  $a = if ($script:wdaOff) { $NONE } else { $EXCLUDE }
  foreach ($k in $script:changed.Keys) {
    try { [PcShieldWin32]::SetWindowDisplayAffinity($script:changed[$k].h, $a) | Out-Null } catch {}
  }
  if ($null -ne $script:form) {
    $script:wdaSelfRead = [PcShieldWin32]::Read($script:form.Handle)
    Update-Bar
  }
  $script:notify.ShowBalloonTip(1800, 'WDA',
    $(if ($script:wdaOff) { '已临时关闭防护' } else { '已恢复防护' }),
    [System.Windows.Forms.ToolTipIcon]::Info)
})

$miReload = $menu.Items.Add('重新加载源文件')
$miReload.Add_Click({
  if ($script:srcPath -and $null -ne $script:tb) {
    try {
      $script:content = Read-Source
      $script:tb.Text = $script:content
      $script:dirty = $false
      Update-Bar
    } catch {}
  }
})

$miAbout = $menu.Items.Add('原理与能力边界')
$miAbout.Add_Click({
  [System.Windows.Forms.MessageBox]::Show($aboutText, '能力边界 · 不夸大',
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
})

$miExit = $menu.Items.Add('退出并恢复窗口属性')
$miExit.Add_Click({
  if ($null -ne $script:cover) { try { $script:cover.Close(); $script:cover.Dispose() } catch {} }
  foreach ($k in $script:changed.Keys) {
    try { [PcShieldWin32]::SetWindowDisplayAffinity($script:changed[$k].h, $script:changed[$k].before) | Out-Null } catch {}
  }
  $script:notify.Visible = $false
  $script:notify.Dispose()
  if ($null -ne $script:form) { $script:form.Close() }
  [System.Windows.Forms.Application]::Exit()
})
$script:notify.ContextMenuStrip = $menu

# ---------------- 启动 ----------------
Write-Report
if ($script:mode -eq 'A-foreign-window') {
  $script:notify.ShowBalloonTip(3000, '模式 A 已生效',
    '已直接对记事本等第三方窗口启用 WDA：本人正常看，截屏/远控中该窗口为黑。请直接在记事本里编辑与保存。',
    [System.Windows.Forms.ToolTipIcon]::Info)
  $ctx = New-Object System.Windows.Forms.ApplicationContext
  [System.Windows.Forms.Application]::Run($ctx)
} else {
  Update-Bar
  $script:notify.ShowBalloonTip(3000, '模式 B 已生效',
    '跨进程 WDA 探测失败（符合 MSDN 限制），已自动降级为自有查看器。默认「可修改」，Ctrl+S 保存。',
    [System.Windows.Forms.ToolTipIcon]::Info)
  [System.Windows.Forms.Application]::Run($script:form)
}
