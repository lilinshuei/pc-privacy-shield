# 实现原理与工程取舍

> 本文件是 `SKILL.md` 第 2 节与第 6 节的展开。需要理解「为什么这么做」时读这里。

## 一、WDA 双模式：不猜系统行为

Windows 的 `SetWindowDisplayAffinity` 设为 `WDA_EXCLUDEFROMCAPTURE`（`0x11`）后，系统在合成「给别人看的画面」时会把该窗口涂黑，而本机显示器上的合成不走这条路径——相当于给窗户装了单向玻璃。

**硬规则**：按 MSDN，这条属性只作用于**属于当前进程**的窗口，记事本不是本程序造的。因此脚本不猜，启动时实测：

```
模式 A（A-foreign-window）
  用 EnumWindows + GetWindowText 找标题含 TargetPattern 的可见窗口
  → SetWindowDisplayAffinity(h, 0x11)
  → GetWindowDisplayAffinity 读回校验
  → 成功：记录原值，托盘常驻，不新建任何窗口
  → 失败：立即恢复原值，probeFailed++

模式 B（B-own-viewer）
  若模式 A 没有成功保护任何窗口
  → 自建 WinForms 查看器窗口，对其 Handle 设 WDA
  → 读回值写入报告与底部状态栏
```

退出时遍历 `$script:changed`，把每个被改动窗口的 affinity 恢复为 `before`，再 `[System.Windows.Forms.Application]::Exit()`。

**WDA 与键盘输入无关**：它只影响「画面合成」这一条路径，不拦截键盘事件。所以查看器可以边防护边正常打字——这是 v2.1.0 编辑开关成立的技术前提。

## 二、格式保真：保存为什么不会改变 .txt 格式

保存功能最容易踩的坑是「写回后编码或换行变了，文件被别的程序认不出来」。`Save-Changes` 的处理顺序：

1. **Probe-Source（启动时）**
   - 读前 3 字节判断是否有 UTF-8 BOM（`EF BB BF`）。
   - 用 `UTF8Encoding(false, true)`（严格模式）尝试解码；失败则回退 `[System.Text.Encoding]::Default`（中文 Windows 为 ANSI/GBK），并记 `srcEnc = 'ANSI'`。
   - 统计换行主风格：优先 CRLF，其次 LF，再次 CR；全无则默认 CRLF。
2. **保存时归一**：`tb.Text` 先 `.Replace(CRLF, LF).Replace(CR, LF)`，再 `.Replace(LF, srcNewline)`。
3. **写回编码**：UTF-8 用 `UTF8Encoding(srcBOM)`（BOM 状态与原件一致）；ANSI 用 `Encoding.Default`。
4. **写前备份**：`Copy-Item` 到 `%APPDATA%\PCPrivacyShield\backups\<文件名>.<时间戳>.bak`。只新增，不删除任何现有文件。

**实测记录（样例文本文件，UTF-8 无 BOM / CRLF）**：

| 用例 | 结果 |
|---|---|
| 加载后原样保存 | SHA256 与原件完全一致，字节数不变 |
| 新增一行中文后保存 | 仍 UTF-8 无 BOM、CRLF 数量正确、0 个裸 LF、中文行完整、严格 UTF-8 校验通过 |

**边界**：若原文件混用多种换行，保存后会统一为探测到的主风格。

## 三、编辑开关的状态机

```
$script:editable = -not $StartReadOnly   # 默认 true
$script:dirty    = $false                # 初始赋值后才挂 TextChanged，避免误判

Toggle-Edit  → 取反 editable；tb.ReadOnly = -not editable；Update-Bar + Write-Report
TextChanged  → 仅当 editable 时 dirty = true，状态栏追加「· 未保存」
Save-Changes → 归一换行 → 备份 → 按原编码写回 → dirty = false → 报告
FormClosing  → dirty 时弹 YesNoCancel；Yes 且保存失败则 Cancel = true
```

模式 A 下没有自建窗体，`Toggle-Edit` 会弹说明框：请直接在记事本里编辑与保存，开关不接管输入。

## 四、诊断报告（不含明文）

`%APPDATA%\PCPrivacyShield\report.json` 字段：

| 字段 | 含义 |
|---|---|
| `version` / `skill` / `time` | 版本与生成时间 |
| `mode` | `A-foreign-window` 或 `B-own-viewer` |
| `osBuild` | 系统版本 |
| `foreignProbeFound` / `foreignProbeFailed` / `foreignProtected` | 跨进程实测结果 |
| `wdaSelfSet` / `wdaSelfRead` | 自建窗口 WDA 设置与读回（成功为 `0x11`） |
| `editable` / `dirty` / `saveCount` | 编辑状态 |
| `source` / `sourceBytes` | 源文件路径与字节数 |
| `sourceEncoding` / `sourceBOM` / `sourceNewline` | 探测到的格式 |
| `containsPlaintext` | 恒为 `false` |

报告只写路径与元数据，**不写明文、不写口令**。

## 五、工程原则

- **不猜系统行为**：运行时实测 + 读回校验 + 自动降级，结果落不含明文的报告。
- **不虚构已保护**：只报实际生效的层；能力边界写进代码、UI、文档三处。
- **显示层与数据层分离**：用户要「不加密、只防看到」就老实给 WDA，不偷偷把加密塞回去，也不假装遮蔽等于加密。
- **零依赖离线**：不引 CDN、不引 npm 包，主路径不需要 Python / Node 运行时。
- **对原文件最小侵入**：默认只读不写盘；仅显式保存才写回，且按原编码/BOM/换行还原。
- **凭据隔离**：进程检测只取名字不取命令行；报告不写明文、不写口令。

## 六、本次迭代「淘汰清单」（取其精华去其糟粕）

| 被淘汰的做法 | 为什么淘汰 | 现在怎么做 |
|---|---|---|
| 往 `.txt` 里直接注入 HTML/JS | 纯文本不执行脚本，且会生成**含明文的新 HTML 副本**，暴露面反而扩大 | 显示层与数据层彻底分离 |
| 全屏黑幕 | 用户明确反馈「整个屏幕全黑影响我操作」 | 只保留**本窗口矩形**的强制遮蔽，且鼠标穿透 |
| 手动开 / 关防护 | 用户明确反馈「开上开下挺麻烦」 | WDA 常驻生效，零开关 |
| 失焦 / 闲置 / 远控三触发自动护航状态机 | 过度设计，且黑块仍会出现在本人屏幕上 | 删除整套状态机，改用 WDA 无感方案 |
| 常驻半透明悬浮球 + 位置记忆 | 视觉干扰，与「不干扰视觉使用」冲突 | 删除；只保留托盘图标 |
| 口令解锁查看器作为「打开密码本」主路径 | 用户明确不要密码 | 降级为可选的数据侧能力 |
| 多个重复启动器 / `.lnk` COM 快捷方式 | 维护成本高；COM 在受限环境常被拦 | 唯一 `launch.cmd`，纯 ASCII |
| 生成含明文的 HTML 副本 | 一处明文副本即可抵消所有加密努力 | 禁止；写盘前强制明文零泄漏断言 |

**保留下来的精华**：类型即边界的判断、诚实的能力分层、WDA 运行时实测 + 读回校验 + 自动降级、AES-256-GCM 与 WebCrypto 二进制兼容、写盘前硬闸门、`--verify` 只读验收、局部遮蔽 + 鼠标穿透、零依赖离线、诊断报告可核验、自检体系。

## 七、加密侧（B 线）关键实现

- AES-256-GCM + PBKDF2-SHA256 / 60 万次迭代；密文格式 v2。
- 把 GCM 的 16 字节认证标签拼在密文末尾，使 **Node 端加密的密文能被浏览器 WebCrypto 直接解开**——否则会出现「口令对了却解不开」。
- 写盘前两道硬闸门：密文与查看器不得出现整段原文、原文 base64 或抽样长行；查看器模板不得含外发/存储 API。
- 口令不写入任何文件，丢失不可恢复。

---

*原创制作人：lilinshuei*
