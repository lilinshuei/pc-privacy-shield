---
name: pc-privacy-shield
display_name: 一键PC隐私防护
display_name_en: One-Click PC Privacy Shield
description: >-
  本机敏感文件与窗口的隐私防护工具，用 WDA_EXCLUDEFROMCAPTURE 让截屏、录屏、
  远控与屏幕共享画面里的窗口变黑而本机正常显示，并可选用 AES-256-GCM 加密静态文件。
  当用户说「防窥屏 / 防远控截屏 / 给密码本加防护 / 一键PC隐私防护 / 别让截屏拍到 /
  保护这个文件夹 / 查看器不能输入 / 可修改禁止修改 / 给工作台加防护按钮」时使用。
  零遮挡、无密码、不改原文件格式、不删除任何文件。
description_zh: >-
  本机敏感文件与窗口的隐私防护工具型 Skill。
  两条主线：①「防看到」用 SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE) 让截屏、
  录屏、远控与屏幕共享画面里的窗口变黑，而本人屏幕正常显示；零遮挡、零开关、无密码，
  启动时自动实测跨进程可行性并降级为自建查看器（可切换可修改或禁止修改）。
  ②「防拿走」用 AES-256-GCM 本地加密把静态文件变成密文，写盘前强制明文零泄漏断言。
  另保留通用能力：给 HTML 工作台注入一键防护悬浮球、给 Electron 桌面窗口启用
  setContentProtection。v2.1.0 起防护查看器带「可修改 / 禁止修改」开关，默认可修改，
  可正常输入新文字与修改；Ctrl+S 显式保存回原文件，写前自动备份并保持原编码与换行格式。
  零依赖离线、不联网、不改注册表/文件关联/系统设置、不删除任何文件。
  当用户说「防窥屏 / 防远控截屏 / 给密码本加防护 / 一键PC隐私防护 / 别让截屏拍到」时使用。
  含诚实能力边界，不夸大可防范围。
description_en: >-
  A local privacy-shield skill for sensitive files and windows.
  Line 1 (anti-viewing) - SetWindowDisplayAffinity with WDA_EXCLUDEFROMCAPTURE blackens
  the window in screenshots, recordings, remote-control and screen-sharing while the
  local user sees it normally; no overlay, no toggling, no passphrase; a runtime probe
  decides between protecting a third-party window directly or falling back to its own
  viewer. Since v2.1.0 the viewer has an editable / read-only switch and explicit save
  that preserves the original encoding and line endings.
  Line 2 (anti-exfiltration) - AES-256-GCM local file encryption with a mandatory
  no-plaintext assertion before writing. Also ships an HTML shield injector and an
  Electron content-protection module. Zero dependencies, offline, no registry changes,
  no file deletions, honest capability boundaries.
examples_zh:
  - "给某个文件夹里的密码本加防截屏保护"
  - "打开查看器后我要能正常打字修改，别锁成只读"
  - "把这份敏感 txt 本地加密成密文，防止被整份拷走"
examples_en:
  - "Protect the password notebook in my folder from screenshots"
  - "Let me type and edit in the viewer, with an editable or read-only switch"
  - "Encrypt this local text file into ciphertext so a copy is useless"
version: 2.2.0
author: "lilinshuei"
allowed-tools: Bash, PowerShell, Read, Write, Edit, Glob, Grep
---

# 一键PC隐私防护

> **原创制作人：lilinshuei** · 版本 2.2.0 · 工具型 Skill，非云服务、非账号体系，断网可用。

## 0. 这一步先判断：用户要的是哪一种保护

**必须先分清两类威胁，不要混成一句「防窥屏」。** 天花板完全不同，选错会返工。

| 用户说什么 | 判定 | 走哪条线 |
|---|---|---|
| 别让截屏/录屏/远控/共享拍到、防窥屏、给密码本加防护 | 怕「被看到」 | **主线 A · WDA**，本 Skill 主路径 |
| 文件被拷走、云同步、外发、备份、电脑被翻 | 怕「被拿走」 | **主线 B · 加密** |
| 给网页后台/看板加防护按钮 | 网页侧通用能力 | `scripts/inject.cjs` |
| 自己的 Electron/Tauri 窗口要防远控 | 桌面侧通用能力 | `scripts/desktop-guard.cjs` |

**铁律**：用户要「不加密、只防看到」就老实给 WDA，不偷偷塞回加密；真怕被拷走就必须接受口令。两者不能互相替代。

---

## 1. 主路径：保护一个文件夹（最常用）

当用户说「对这个目录用一下 / 保护这个路径中的文件」时，按以下步骤执行：

1. **只读清点**目标目录，确认文件类型与是否存在 `.txt`。不要读取或输出任何明文内容。
2. **在该目录新建一个纯 ASCII 的 `.cmd` 启动器**（不要写中文路径，用 `%~dp0` + 环境变量传递）：

   ```cmd
   @echo off
   set "PC_SHIELD_DIR=%~dp0"
   if not defined PC_SHIELD_HOME set "PC_SHIELD_HOME=%USERPROFILE%\.dsh\skills\pc-privacy-shield"
   start "" /B powershell.exe -NoProfile -Sta -ExecutionPolicy Bypass -WindowStyle Hidden -File "%PC_SHIELD_HOME%\scripts\pc-shield.ps1"
   ```

   `PC_SHIELD_DIR` 让脚本自动在该目录找 `*.txt`，优先匹配标题含 `TargetPattern`（默认「密码本」）的文件；也可用 `-Source` 指定精确路径。若 Skill 不在默认安装位置，先设置 `PC_SHIELD_HOME`。`PC_SHIELD_DIR` 让脚本自动在该目录找 `*.txt`，优先匹配标题含 `TargetPattern`（默认「密码本」）的文件；也可用 `-Source` 指定精确路径。
3. **告知用户双击启动器**。说明实际防护要在他自己的 Windows 桌面会话里激活，工具会话的命令安全策略可能拒绝 `Add-Type` 编译 .NET 与派生 GUI 进程。
4. **核验**：读 `%APPDATA%\PCPrivacyShield\report.json`，看 `mode`、`wdaSelfRead`（应为 `0x11`）、`foreignProbeFound` / `foreignProbeFailed`。报告不含明文。
5. **交付时必须复述第 5 节能力边界**，不得宣称「装了就防远控 / 防一切截屏」。

### 运行后会发生什么

- **模式 A**：跨进程 WDA 实测成功 → 直接保护记事本等第三方窗口，**不新建任何窗口**。此时用户本来就能在记事本里自由编辑与保存，编辑开关不接管输入。
- **模式 B**：探测失败（符合 MSDN 限制）→ 恢复原值，自动弹出本程序自建的**防护查看器**并对它设 WDA。

---

## 2. 查看器的「可修改 / 禁止修改」开关

**WDA 只影响「给别人看的画面合成」，不拦截键盘输入**，因此查看器可以边防护边正常打字。这是 v2.1.0 起的行为。

| 状态 | 能否输入与修改 | 是否动原文件 |
|---|---|---|
| **可修改**（默认） | 能，像记事本一样 | **不自动写**；按 `Ctrl+S` 或点「保存」才写回 |
| **禁止修改** | 不能，纯只读 | 不会 |

- 切换三入口：底部右侧按钮（显示当前状态）／托盘菜单／`Ctrl+E`。
- 保存三入口：`Ctrl+S`／底部「保存」按钮／托盘「保存修改到原文件」。
- 状态栏实时显示当前状态；有改动未存标 `· 未保存`；关闭时弹「保存 / 不保存 / 取消」。
- 启动即只读：加 `-StartReadOnly`。

**保存的四个保证**（实现细节见 `@references/implementation.md`）：

1. 写前用 `Probe-Source` 探测原文件编码（UTF-8 strict / 系统 ANSI）、有无 BOM、换行风格（CRLF / LF / CR）。
2. 写回按原样还原；换行先归一为 LF 再按原风格还原，**不改变文件格式**。
3. 写前 `Copy-Item` 备份到 `%APPDATA%\PCPrivacyShield\backups\<文件名>.<时间戳>.bak`，只新增、不删除任何现有文件。
4. 不点保存则原文件一字不动。

> **重要**：磁盘脚本升级不会热更新已运行的旧窗口。改动 `pc-shield.ps1` 后，必须让用户先在托盘「退出并恢复窗口属性」，再重新双击启动器。

---

## 3. 命令速查

所有可执行脚本位于 `scripts/`。完整参数与 CLI 示例见 `@references/command-reference.md`。

```bash
# 主路径：由启动器双击触发，或直接执行
powershell.exe -NoProfile -Sta -ExecutionPolicy Bypass -WindowStyle Hidden \
  -File "<SKILL_DIR>\scripts\pc-shield.ps1" -Source "<目标文件.txt>"

# 自检（改动后必须跑）
node "<SKILL_DIR>\scripts\verify.cjs"

# B 线：本地加密 / 演练 / 只读验收 / 换口令
node "<SKILL_DIR>\scripts\protect-file.cjs" --in "<文件>" [--dry-run|--verify|--rekey]

# 网页侧：注入防护悬浮球
node "<SKILL_DIR>\scripts\inject.cjs" --in "工作台.html" --out "工作台·防护版.html"
```

`scripts/vault-viewer.template.html` 是 B 线口令查看器模板，由 `scripts/file-vault.cjs` 按同目录规则读取。

---

## 4. 目录结构与资源引用

```
pc-privacy-shield/
├── SKILL.md                          # ★ 技能定义（必须）
├── scripts/                          # 可执行脚本（主副本）
│   ├── pc-shield.ps1                 # 主路径：WDA 双模式 + 编辑开关 + 托盘 + 报告
│   ├── launch.cmd                    # 唯一启动器模板（纯 ASCII）
│   ├── verify.cjs                    # 自检
│   ├── file-vault.cjs                # B 线加密核心
│   ├── protect-file.cjs              # B 线 CLI
│   ├── inject.cjs                    # 网页注入器
│   ├── shield.web.js / shield.css    # 网页层运行时（与 inject.cjs 同目录，勿拆开）
│   ├── vault-viewer.template.html    # 运行时实际读取的模板（与 file-vault.cjs 同目录）
│   └── desktop-guard.cjs             # Electron 桌面层
└── references/                       # 参考资料（按需读取）
    ├── capability-boundaries.md      # 能力边界与威胁模型
    ├── implementation.md             # WDA 原理、格式保真、硬约束
    ├── command-reference.md          # 参数与命令速查
    └── sharing-kit.md                # 图标提示词与对外分享文案
```

**引用方式**：正文中以 `@references/xxx.md` 声明补充知识，执行技能时按需读取。

---

## 5. 能力边界（交付时必须复述）

1. **WDA 不是加密**：原文件仍是明文，不防文件被复制、被云同步、被已入侵本机的程序读取。
2. **WDA 挡不住**注入式截屏（进程内 hook DWM）、驱动级捕获；已建立的远控会话常需重建窗口才生效。此时用托盘「强制遮蔽」。
3. **按 MSDN，`WDA_EXCLUDEFROMCAPTURE` 只作用于属于当前进程的窗口**；对记事本这类第三方窗口能否设置由脚本启动时实测，不预先断言。
4. 不防键盘记录、麦克风/摄像头、站在身后的人。
5. 强制遮蔽的黑板在你自己屏幕上**看得见**；它只盖目标窗口、鼠标穿透，但不是视觉无感。
6. 加密方案的口令丢失 = 数据不可恢复，无后门。
7. 所有检测均为只读提示，不结束进程、不改注册表、不改文件关联、不改系统设置、不装驱动、不写开机自启。
8. 全程离线、零依赖：不引 CDN、不引 npm 包，主路径不需要 Python / Node 运行时。
9. **不删除任何文件**（见第 6 节）。保存只做「写回原文件 + 新增一份备份」，不删除/不移动/不重命名任何现有文件。
10. **编辑只发生在防护查看器（模式 B）**；模式 A 请直接在记事本里编辑与保存。
11. **保存是有代价的写操作**：会更新原文件内容与修改时间（格式不变）；备份文件是**明文副本**，位于 `%APPDATA%\PCPrivacyShield\backups\`，与原件同等敏感。自动备份只增不删，长期累积会占用少量空间。
12. **格式保真的边界**：编码与换行按「探测到的主风格」还原；若原文件混用多种换行，保存后会统一为主风格。

完整威胁模型与逐条解释见 `@references/capability-boundaries.md`。

---

## 6. 硬约束（最高优先级）

- **零删除**：任何现有文件一律**不删除、不移入回收站、不移动、不重命名、不清空**。所有脚本经自检强制断言零删除调用；需要清理时只做只读清单，须逐项点名确认。
- **显示层与数据层分离**：不偷偷把加密塞回「只防看到」的需求，也不假装遮蔽等于加密。
- **运行时实测而非文档断言**：能实测的就不猜，结果落报告。
- **不虚构已保护**：能力报告只写实际生效的层。
- **凭据隔离**：进程检测只取名字不取命令行；报告不写明文、不写口令。

---

## 7. 验收

`node scripts/verify.cjs` 检查：frontmatter 必填字段、目录结构与资源齐备、`@references` 引用、零删除断言、启动器纯 ASCII、Node 模块语法编译。

主路径的运行级验证由用户双击启动器完成；工具会话的命令安全策略可能拒绝 `Add-Type` 编译 .NET 与派生 GUI 进程，用户桌面会话不受此限制，读 `report.json` 即可核验。

---

## 8. 参考资料索引

| 文件 | 何时读 |
|---|---|
| `@references/capability-boundaries.md` | 需要向用户解释能防什么、不能防什么时 |
| `@references/implementation.md` | 需要理解 WDA 双模式、格式保真、编码探测、设计取舍时 |
| `@references/command-reference.md` | 需要完整参数、CLI 示例、报告字段时 |
| `@references/sharing-kit.md` | 需要生成图标或写对外分享文案时 |

---

*原创制作人：lilinshuei · 一句话定位：你要正常看，别人要拍不到、拿不走。*
