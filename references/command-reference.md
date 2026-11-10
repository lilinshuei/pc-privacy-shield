# 命令与参数速查

> 本文件是 `SKILL.md` 第 3 节的展开。所有路径以技能根目录为基准；`<SKILL_DIR>` 指本 Skill 的安装绝对路径。

## 一、主路径：pc-shield.ps1

```powershell
powershell.exe -NoProfile -Sta -ExecutionPolicy Bypass -WindowStyle Hidden `
  -File "<SKILL_DIR>\scripts\pc-shield.ps1" `
  -Source "<目标目录>\密码本.txt"
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `-Source` | 空 | 源文件精确路径（优先） |
| `-SourceDir` | 空 | 未给 Source 时在此目录找 `*.txt`；也可用环境变量 `PC_SHIELD_DIR` |
| `-TargetPattern` | `密码本` | 模式 A 探测用的窗口标题匹配串；想盯别的窗口就改这里 |
| `-StartReadOnly` | 关 | 启动即「禁止修改」（默认「可修改」） |
| `-NoForeignProbe` | 关 | 跳过跨进程探测，直接建自己的窗口 |
| `-NoReport` | 关 | 不写诊断报告 |

### 启动器模板（scripts/launch.cmd）

内容刻意保持**纯 ASCII**，中文目录通过 `PC_SHIELD_DIR` 环境变量传递，避免批处理中文路径乱码：

```cmd
@echo off
set "PC_SHIELD_DIR=%~dp0"
if not defined PC_SHIELD_HOME set "PC_SHIELD_HOME=%USERPROFILE%\.dsh\skills\pc-privacy-shield"
start "" /B powershell.exe -NoProfile -Sta -ExecutionPolicy Bypass -WindowStyle Hidden -File "%PC_SHIELD_HOME%\scripts\pc-shield.ps1"
```

把 `.cmd` 放在敏感文件所在目录，双击即可；脚本自动在该目录找 `*.txt`，优先匹配标题含 `-TargetPattern` 的文件。

### 托盘菜单

| 菜单项 | 作用 |
|---|---|
| 可修改 / 禁止修改（切换，Ctrl+E） | 切换查看器能否输入与修改，默认「可修改」 |
| 保存修改到原文件（Ctrl+S） | 写回原 `.txt`，写前自动备份、保持原编码与换行 |
| 强制遮蔽 / 恢复 | 应急兜底：不透明遮板只盖本窗口、鼠标穿透 |
| 关闭 / 开启 WDA | 自己要截图时临时关闭，再开回来 |
| 重新加载源文件 | 放弃未保存改动，从原文件重新读取显示 |
| 原理与能力边界 | 打开完整边界说明 |
| 退出并恢复窗口属性 | 恢复所有被改动窗口的 affinity 后退出 |

**快捷键**：`Ctrl+E` 切换编辑状态，`Ctrl+S` 保存。

> 注意：磁盘脚本升级**不会热更新已运行的旧窗口**。改动 `pc-shield.ps1` 后须先在托盘退出，再重新双击启动器。

## 二、自检

```bash
node "<SKILL_DIR>\scripts\verify.cjs"
```

静态检查：frontmatter 必填字段、目录结构与资源齐备、`@references` 引用、启动器纯 ASCII、零删除断言与 Node 模块语法编译。不执行 GUI、不联网、不删除文件。

## 三、B 线：本地加密（需要口令）

```bash
node "<SKILL_DIR>\scripts\protect-file.cjs" --in "文件"                 # 生成密文 + 口令查看器
node "<SKILL_DIR>\scripts\protect-file.cjs" --in "文件" --dry-run       # 只演练、不写文件
node "<SKILL_DIR>\scripts\protect-file.cjs" --verify --in "密文.json" --source "原文.txt"
node "<SKILL_DIR>\scripts\protect-file.cjs" --rekey --in "密文.json" --password "<旧>" --new-password "<新>" --force
```

建议用环境变量 `PS_VAULT_PASS` 传口令，避免留在命令行历史。写盘前有两道硬闸门：密文与查看器不得出现整段原文、原文 base64 或抽样长行；查看器模板不得含外发/存储 API。口令不写入任何文件，丢失不可恢复。

**本次场景用户明确不要密码，因此这条是可选高级能力，不是主路径。**

## 四、网页侧：注入防护悬浮球

```bash
node "<SKILL_DIR>\scripts\inject.cjs" --in "工作台.html" --out "工作台·防护版.html"
node "<SKILL_DIR>\scripts\inject.cjs" --in "工作台.html" --dry-run
```

纯追加、幂等、原文一字不改、可离线打开。`inject.cjs` 依赖同目录的 `shield.web.js` 与 `shield.css`，**三者不可拆开**。

可选参数：`--mark`（动态水印）、`--auto-blur`（失焦自动遮蔽）、`--watermark`、`--block-copy`、`--block-upload`（外发白名单）。

## 五、Electron 桌面侧

主进程中：

```js
const g = require('./scripts/desktop-guard.cjs');
g.applyToElectron(win, { autoOnRemote: true });
```

调 `setContentProtection` 让窗口在远控截屏里真变黑；只读检测远控进程，不结束进程、不改注册表、不装驱动。

## 六、诊断报告字段

路径：`%APPDATA%\PCPrivacyShield\report.json`。完整字段表见 `@references/implementation.md` 第四节。关键核验项：`mode`、`wdaSelfRead`（成功为 `0x11`）、`foreignProbeFound` / `foreignProbeFailed`、`editable`、`sourceEncoding`、`sourceNewline`、`containsPlaintext`（恒 `false`）。

---

*原创制作人：lilinshuei*
