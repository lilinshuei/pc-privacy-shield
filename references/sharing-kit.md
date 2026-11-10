# 一键PC隐私防护 · 分享素材

> 本文件只放两样东西：**图标 AI 生成提示词**、**对外分享文案**。
> 文案刻意采用客观第三人称转述口吻：不宣称所有权、不夸大能力、保留边界说明。

---

## 一、图标 AI 生成提示词

### 设计意图：元素 → 含义

| 图标元素 | 传神地表达什么 |
|---|---|
| 被一道竖直光缝一分为二的玻璃窗口 | 「同一块内容，两种视角」——本 Skill 的核心矛盾 |
| 左半清晰、有文件行与钥匙 | 本人正常看得见，且内容是敏感文件 |
| 右半沉入纯黑哑光虚空 | 截屏 / 录屏 / 远控 / 共享拍到的只有黑 |
| 右缘镜头／眼睛剪影，反射里只有黑矩形 | 点睛之笔：不是「把屏幕挡住」，而是「拍的人什么也没拿到」 |
| 上方一枚发光圆形按钮 | 「一键」，也是画面里唯一的交互元素 |
| 深藏青底 + 金边 + 青色内光 | 安全、克制、可靠；游戏图标质感但不喧闹 |

### 主提示词（英文，直接粘贴给 GPT / 图像生成模型）

```
A premium square game-style app icon, 1:1, perfectly centered, no text, no letters, no numbers, no logos, no watermark.

Concept — "one-way privacy glass": the person sitting at the computer sees everything normally, but every screenshot, screen recording, remote-desktop session and screen-share sees only a black void.

Composition: a dark-navy rounded-square badge with a thin brushed-gold rim and a soft cyan inner glow. Floating in the center is a translucent frosted-glass window panel split by a single vertical luminous seam.
- LEFT half: crisp and gently lit, showing abstract rows of a document and a tiny key glyph — calm, readable, safe.
- RIGHT half: the same panel dissolving into a perfectly matte black void, the document lines swallowed by shadow; a subtle gold edge traces exactly where the light stops.
Above the panel: one glowing amber circular button with a pressed-in bevel and a soft halo — the "one click", the only interactive element in the image.
At the right edge: a small stylized camera-lens / eye silhouette; inside its reflection there is ONLY a pure black rectangle, no content at all. This is the punchline of the icon.

Materials and lighting: brushed metal, frosted glass, emissive gold and cyan accents, restrained volumetric light, soft bevel, high-detail digital painting, AAA game UI / sci-fi HUD icon aesthetic, strong readable silhouette even at 64 px, deep dark background, dramatic but not busy.

Mood: quiet confidence — protection without obstruction; nothing is covered on the user's own side.
```

### 中文版提示词（给 GPT 中文对话用）

```
请生成一枚 1:1 方形、居中构图的高质感游戏风格应用图标，不要出现任何文字、字母、数字、品牌标识或水印。

核心概念叫「单向隐私玻璃」：坐在电脑前的人照常看得见内容；而截图、录屏、远程控制、会议共享这些「给别人看的画面」里，那块窗口只剩纯黑。

构图：深藏青色圆角方形底板，一圈细拉丝金边，内部有淡青色柔光。正中悬浮一块半透明磨砂玻璃窗口，被一道竖直发光缝一分为二：
· 左半清晰明亮，能看到抽象的文件行和一个极小的钥匙符号，安静、可读、安全；
· 右半同样的窗口沉入纯黑的哑光虚空，文件行被阴影吞掉，只在光停下的地方留一道金边。
窗口上方是一枚发暖金色光的圆形按钮，带按下感的倒角与柔和光晕——代表「一键」，也是画面里唯一的交互元素。
画面右缘放一个极简的镜头／眼睛剪影，它的反射里只有一块纯黑矩形，没有任何内容——这是整枚图标的点睛之笔。

材质与光线：拉丝金属、磨砂玻璃、金色与青色自发光点缀、克制的体积光、柔和倒角、高精度数字绘画、3A 游戏 UI / 科幻 HUD 图标质感；缩到 64px 仍能一眼读懂轮廓；深色背景，有戏剧感但不杂乱。
气质：安静的可靠感——用户这一侧什么都没有被挡住。
```

### 负面提示词

```
text, letters, words, numbers, typography, watermark, signature, logo, brand name,
UI screenshot, real document, readable password, human face, hands, photorealism,
clutter, busy background, multiple panels, low contrast, blurry, jpeg artifacts,
cropped edges, asymmetric framing, bright white background
```

### 风格变体（同一意象，换皮不换骨）

- **B · 扁平徽章**：`Flat vector badge version of the same one-way-privacy-glass concept: 2-3 flat color shapes only, thick clean outlines, no gradients, no 3D, minimal app-store icon style, dark navy + gold + cyan, 1:1, no text.`
- **C · 等距 3D**：`Isometric 3D version of the same concept: a small frosted-glass panel floating above a dark pedestal, half lit with document lines, half pure matte black, one amber button on top, a tiny lens silhouette reflecting only black; orthographic isometric view, PBR materials, soft studio light, 1:1, no text.`

### 参数建议

- 比例 `1:1`，分辨率 `1024×1024`；深色背景或透明底二选一
- 明确写 `no text`——图像模型容易在图标里生成乱码字母
- 生成后缩到 `64×64` 看一眼：轮廓还读得懂才算合格
- 若「镜头反射纯黑」没画出来，把那一句提到提示词最前面重跑

---

## 二、朋友圈文案（客观转述，不宣称所有权）

### 短版

> 看到一个挺巧的分层思路，分享一下。
>
> 电脑上放敏感文件，常见两种办法都有点打断人：加密吧，每次看要输密码；防窥开关吧，得记得开、记得关，一开还常常整屏变黑。
>
> 另一种做法是让系统自己处理：给窗口设一个「截屏排除」的属性。本人屏幕照常看得见内容，但截图、录屏、远程协助、会议共享这些「给别人看的画面」里，那块窗口是黑的。不用开关、不用密码，屏幕上也没有遮挡。用法也简单，把一个小启动器放在文件旁边，双击一下就好。
>
> 比较喜欢的是它把两类风险分开讲：拍屏幕归拍屏幕，文件被整份拷走归文件被拷走，后者还是得靠加密。注入式截屏、驱动级捕获、键盘记录、有人站在身后，也都不在这个范围内。
>
> 不是万能的，但这个分类方式挺干净，分享给大家参考。

### 长版

> 分享一个看到的分层思路，觉得挺值得记一下。
>
> 【它解决的到底是什么】
> 不是「怎么把文件锁起来」，而是「怎么在不打断自己的前提下，别让别人看到」。这两件事经常被混成一句「防窥屏」，其实完全不是一回事。
>
> 【常见做法各卡在哪】
> · 加密：安全，但每次看要输口令，看完还得收拾；
> · 防窥贴膜：只挡斜着看的人；
> · 一键黑幕：得记得开、记得关，而且常常整屏变黑，自己也没法干活。
>
> 【另一种做法】
> 让操作系统自己动手：给窗口设一个「不参与截屏合成」的属性。于是本人屏幕上一切正常，截图、录屏、远程控制、会议共享这些「给别人看的画面」里，那块窗口是黑的。没有遮挡、没有开关、不用密码、文件格式也不用改。用法简单到有点朴素：把一个小启动器放到文件同目录，双击，就完事了。
>
> 【定位】
> 它属于「查看时的隐私保护」，不是加密、不是权限管控、也不是终端安全。所以文件真要外发、备份、同步，或者怕被整份拷走，还是得老老实实用加密。
>
> 【边界也讲得挺老实】
> 挡不住注入式截屏、驱动级捕获、键盘记录，也不防有人直接站在身后看屏幕；远程会话已经连上的时候，有时要重开窗口才生效。愿意把「做不到」写清楚，比一句「绝对安全」可信多了。
>
> 纯粹觉得这个分类方式干净，分享给大家参考。

### 可选：想点名时的替换句

把「另一种做法是让系统自己处理」换成：

> 「有个叫『一键PC隐私防护』的工具，做法是让系统自己处理……」

仍是转述见闻，不构成所有权声明；其余段落不用改。

---

## 三、发布注意（降低被抬杠的概率）

1. **不写**「我做的 / 自研 / 我的产品 / 开发了一个 / 我的 Skill」，全篇用「看到 / 分享 / 这个做法 / 这类工具」。
2. **保留边界段**，不要为了好看删掉；删了反而容易被质疑夸大。
3. **不写**「绝对安全 / 100% 防截屏 / 黑客拿不到」这类满话。
4. 用「远程控制 / 屏幕共享 / 录屏」等中性词，**不点名具体软件品牌**。
5. **不配**真实文件、密码本、后台界面的截图；要配图就配上面生成的概念图标。
6. 有人追问实现细节，一句「我也是看到的思路，具体以工具说明为准」即可，不必替它背书。
