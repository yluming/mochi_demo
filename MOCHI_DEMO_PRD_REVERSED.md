# Mochi Demo 2.0 需求说明书 (PRD)

本档根据当前最新的 Demo 实现（2.0 版本）进行反向推导编写，旨在清晰定义前端逻辑、交互细则以及后端对接所需的数据结构。

---

## 1. 核心业务价值
Mochi 定位于"情绪伴侣"，通过轻量化的碎片记录（Emotion Blobs）和适时的深度交流（Session-based Chat），为用户提供无压力的情绪排解空间。其核心在于 **"分段式存档"** 与 **"时效性反馈"**。

---

---

## 2. 页面逻辑与数据定义

### 2.0 账号系统 (Account System)
Demo 实现了基础的手机号登录逻辑，用于区分用户数据。

#### 核心交互逻辑：
- **手机号登录**: 用户输入 11 位手机号即可进入应用。
- **登录状态持久化**: 在前端管理 `isLoggedIn` 状态，退出登录时清除。
- **退出登录确认**: 设置页面支持退出登录，点击后弹出二次确认弹窗。
- **头像角标**: 用户头像上会显示手机号后四位（如 "3721"）作为简单的身份标识。

#### 后端数据需求：
**认证接口 (POST /api/auth/login):**
```json
{
  "phoneNumber": "13800003721"
}
```
响应应返回用户信息及 Token（Demo 阶段为模拟返回值）。

---

### 2.1 情绪首页 (Home Page)
首页以"情绪罐头"为核心视觉符号，承载日度的情绪汇总。

#### 核心交互逻辑：
- **日期滚动 (Date Roller)**: 
  - 支持横向左右滑动查看历史日期。
  - **有记录状态**: 如果该日期包含 `hasRecords: true`，则颜色加深且可点击切换。
  - **无记录状态**: 如果该日期无数据，则置灰且禁用（不可点击）。
- **物理互动 (Jar Physics)**: 界面根据当日情绪碎片（Blobs）的数量和类型（颜色/大小）动态渲染物理碰撞效果。
- **主动记录 (Manual Entry)**: 点击右下角 `+` 号开启引导流程，录入情绪后生成新的 Blob。
- **语音输入 (Voice Input)**: 
  - 在 Onboarding 和 Chat 页面支持长按麦克风按钮进行语音输入。
  - 使用浏览器原生 Web Speech API (`SpeechRecognition`) 进行实时转写。
  - 录音时显示音量可视化动画和实时转写文本预览。

#### Header 区域内容（红框区域）
- **显示内容**: 日期（`dateStr`）、星期（由 `dateStr` 拆分）、右上角 Emoji（`emoji`）、状态卡文案（`statusText`）与前置图标（`whisper.icon`）。

#### Header 空态（当日无记录）
- **主文案**: 今天还没有记录呢
- **副文案**: 先把这一刻放进情绪罐头，Mochi 会帮你总结。
- **操作提示（可选）**: 点击 + 开始记录，也支持语音输入
- **视觉**:
  - 保持玻璃感胶囊卡样式，但降低对比度
  - 使用 `Sparkles` 或小罐子图标作为前置图标
  - 色彩保持温和中性，避免盖过 Header 渐变

#### Header 刷新规则（Demo 简化版）
- **刷新时机**:
  1. 当日第一次进入首页（若当天有 `daily_status`，拉取并更新）
  2. 当日首次新增 Blob（从 0 变为 1 时，拉取并更新）
  3. 切换日期（Date Roller 切换时更新）
- **不刷新**: 每新增一个 Blob 都刷新（避免频繁跳变，维持"当日摘要"的语义）

#### 后端数据需求：

**A. 时间轴概览 (GET /api/timeline):**
用于渲染顶部的日期滚动条。
```json
[
  { "id": "tue5", "label": "Tue 5", "hasRecords": false },
  { "id": "wed6", "label": "Wed 6", "hasRecords": true },
  { "id": "today", "label": "Today", "hasRecords": true }
]
```

**B. 单日详情 (GET /api/daily_status?dateId={id}):**
用于渲染具体的罐头内容。
| 字段名 | 类型 | 说明 | 视觉映射位置 |
| :--- | :--- | :--- | :--- |
| `id` | String | 日期唯一标识 (如 `tue5`, `today`) | - |
| `label` | String | 滚动条显示的简写 (如 `Tue 5`, `Today`) | 顶部滚动条标签 |
| `dateStr` | String | 头部显示的完整日期 (如 `2025年11月9日`) | 页面左上角大标题 |
| `emoji` | String | 当日主情绪 Emoji | **页面右上角图标** |
| `statusTitle` | String | 状态卡片的标题 (如 `今日状态`) | (逻辑字段) 定位内容性质 |
| `statusText` | String | 首页状态卡片的文字描述 | **白色胶囊卡片主文本** |
| `whisper.icon` | Object | 状态卡片的图标 | **白色胶囊卡片前置 Icon** |
| `blobs` | Array | 当日捕捉到的碎片列表 (详见 3.1) | 罐头内的彩色圆球 |
| `events` | Array | 当日关键事件列表 (Emoji + 文本) | **历史模式下的收银小票** |
| `whisper.text` | String | 深度观察文本 | (预留字段) 暂不直接显示 |

#### 2.1.1 历史模式 (History Mode)
当用户切换到非今日的日期时：
- **物理状态**: 
  - 罐子被封存（Flat Cap）。
  - Blob 预先模拟物理堆叠，自然沉淀在罐底。
- **互动体验**:
  - 罐身上贴有一张 **"牛皮纸质感"** 的收银小票。
  - **小票内容**: 展示当日的 `events` 列表，采用 `Emoji + 短句` 的形式（例如 "🎧 随口记了一句有点累"）。
  - **揭开封印**: 点击小票，小票卷起飞走，罐子变亮，Blob 微微跳动唤醒，允许查看和互动。

---

### 2.2 聊天页面 (Chat Page - Multi-Session)
聊天室不再是单一的无限流，而是基于"阶段（Session）"进行管理的。

#### 核心交互逻辑：
- **三段式布局 (Tiered Layout)**:
  1. **历史追溯**: 最上方展示已褪色的历史对话（Opacity 0.5）。
  2. **封存节点 (End Card)**: 当一个会话结束，出现的总结卡片。卡片上方伴随"已封存于 [Timestamp]"的标识。
  3. **活跃会话 (Active Session)**: 每一个新的"聊聊这个瞬间"点击，都会开启一个带有独立时间戳的新 Block。
- **自动对焦**: 进入 Chat 页面或产生新内容时，强制滚动到最下方的最新 Block（考虑 600ms 动画延迟）。
- **实时模拟**: 输入框发送后追加到最新的 Session 消息队列中，并触发模拟 AI 回复。
- **语音输入**: 支持长按麦克风进行语音输入，实时转写显示在输入框中。

#### 后端数据需求 (GET /api/chat/sessions):
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `sessionId` | String | 会话唯一 ID |
| `timestamp` | String | 该会话开启的精确时间 |
| `messages` | Array | `[{ type: 'ai'/'user', text: string }]` 会话内的消息流 |
| `isClosed` | Boolean | 该会话是否已生成 End Card 并封存 |
| `endCardContent`| String | (可选) 如果已封存，对应的总结语内容 |

**🤖 LLM Prompt 需求点 #1: Chat Session 回复生成**
- **触发时机**: 用户在 Chat 页面发送消息后
- **输入上下文**: 
  - 当前 Session 的完整对话历史 (`messages[]`)
  - 如果是从 Blob 点击进入的，还需要 Blob 的 `label` 和 `note` 作为话题锚点
- **输出要求**: 生成温暖、共情的 AI 回复文本
- **Prompt 模板**: `[待补充]`

---

### 2.3 设备与配对 (Device Page)
简易的设备状态管理页面。

#### 核心交互逻辑：
- 扫描、配对流程的 UI 演示。
- 数据仅需状态标记（已连接/离线）。
- **退出登录确认**: 点击"退出登录"按钮时，弹出确认弹窗防止误操作。

---

## 3. 核心数据对象模型 (Schema)

### 3.1 Emotion Blob (情绪碎片)
```json
{
  "id": "unique_id",
  "r": "number (40-50, 对应视觉半径)",
  "color": "String (Hex code)",
  "label": "String (关键词)",
  "time": "String (捕捉时间点)",
  "note": "String (详细记录/日记内容)",
  "source": "manual / chat / auto",
  "isDiscussed": "Boolean (是否已被讨论过，影响视觉状态)"
}
```

**新增字段说明**:
- `isDiscussed`: 标记该 Blob 是否已经被用户点击并进入过对话。已讨论的 Blob 会显示为"白色核心 + 淡色光晕"的视觉效果。

### 3.2 Chat Session (对话会话)
```json
{
  "id": "unique_id",
  "timestamp": "2025/12/2 · 4:40 PM",
  "messages": [
    { "type": "ai", "text": "..." },
    { "type": "user", "text": "..." }
  ],
  "relatedBlobId": "String (可选, 如果是从 Blob 点击进入的会话)"
}
```

**新增字段说明**:
- `relatedBlobId`: 用于关联该对话是从哪个 Blob 发起的，方便后续分析和状态同步。

### 3.3 User Profile (用户信息)
```json
{
  "id": "user_id",
  "phoneNumber": "String (手机号)",
  "phoneSuffix": "String (手机号后四位，如 '3721')",
  "avatar": "String (头像 URL，可选)",
  "daysWithMochi": "Number (与 Mochi 相处的天数)"
}
```

**字段说明**:
- `phoneSuffix`: 用于在设置页面的头像角标上显示，作为简单的身份标识。
- `daysWithMochi`: 在设置页面显示为"与 Mochi 的第 X 天"，增强情感连接。

---

## 4. 主动交互与反馈机制 (Proactive Engagement)

### 4.1 视觉状态反馈系统

#### A. "已讨论" 状态 (Processed Memory)
- **触发条件**: 
  - 用户点击某个 Blob 并选择"聊聊这个瞬间"
  - 用户通过推送通知进入对话
- **视觉效果**: 
  - Blob 的 SVG 渐变中心变为半透明白色 (`#FFFFFFB0`)
  - 外圈保留原色的淡淡光晕
  - 整体透明度降低至 `0.6`
- **数据同步**: 前端需要调用 `PATCH /api/blobs/{id}` 更新 `isDiscussed: true`

**后端 API 需求 (PATCH /api/blobs/{id}):**
```json
{
  "isDiscussed": true
}
```

#### B. "闪烁提示" (Shimmering Nudge)
- **触发条件**: 未讨论的 Blob 会随机被选中进行视觉提示
- **视觉效果**: 在 Blob 表面随机位置生成 2-3 个小星星 SVG，执行 `scale(0 → 1 → 0)` 的闪烁动画
- **触发频率**: 每 8-10 秒随机选择一个未讨论的 Blob 进行提示
- **实现方式**: 纯前端视觉层，不影响物理引擎

### 4.2 推送通知模拟 (Simulated Push Notification)

#### 核心逻辑：
- **触发条件**: 
  - 用户在首页停留超过 12 秒
  - 当前日期有至少 1 个未讨论的 Blob (`isDiscussed: false`)
- **视觉呈现**: 
  - 从屏幕顶部滑入一个半透明白色横幅
  - 包含 Mochi 图标、标题、正文和关闭按钮
  - 点击横幅后直接进入针对该 Blob 的对话 Session
- **状态更新**: 点击推送后，自动将对应 Blob 标记为 `isDiscussed: true`

**后端 API 需求 (GET /api/notifications/suggest):**
返回当前最适合推送的 Blob 信息（可选，也可以由前端从未讨论列表中随机选择）
```json
{
  "blobId": "unique_id",
  "title": "Mochi 刚才在想...",
  "body": "关于【焦虑】的那个瞬间，想听你多说几句... ✨"
}
```

**🤖 LLM Prompt 需求点 #2: 推送通知文案生成**
- **触发时机**: 后端生成推送通知时
- **输入上下文**: 
  - Blob 的 `label` 和 `note`
  - 用户的历史对话摘要（可选）
- **输出要求**: 生成温暖、好奇的推送文案，引导用户点击
- **Prompt 模板**: `[待补充]`

### 4.3 首次记忆碎片引导 (First Memory Modal)

#### 核心逻辑：
- **触发条件**: 用户完成 Onboarding 并创建第一个 Blob 后
- **延迟显示**: 延迟 2 秒后从底部滑入弹窗，让用户先看到首页和 Blob 掉落动画
- **视觉效果**: 
  - 从底部滑入的半透明白色卡片
  - 包含庆祝 Emoji (🎉)、标题、描述和 CTA 按钮
  - 使用柔和的 Spring 动画 (`damping: 30, stiffness: 180`)
- **交互**: 点击"聊聊这个瞬间"按钮后，进入针对该 Blob 的对话 Session

---

## 5. 情绪色彩系统 (Design System)

为了增强情绪共鸣，界面的视觉风格将随当日主情绪（Emoji）动态变化。

### 5.1 每日摘要色彩 (Header Gradients)
用于决定当日顶部的渐变底色，反映该日期的 **整体情绪基调**。

| 情绪大类 | 对应 Emoji | 顶部 Header 渐变色推荐 |
| :--- | :--- | :--- |
| **治愈/清新** | 😇, 😌, 🌿 | `linear-gradient(135deg, #A5F3FC, #BBF7D0)` (蓝绿交织) |
| **积极/能量** | 🤩, ⚡️ | `linear-gradient(135deg, #FDE68A, #FEF3C7)` |
| **沉思/疲惫** | 😴, 🧘‍♂️ | `linear-gradient(135deg, #DDD6FE, #F5F3FF)` |
| **敏感/波动** | 😤, 😞 | `linear-gradient(135deg, #F9A8D4, #FDF2F8)` |

### 5.2 记录碎片色彩 (Blob Palettes)
用于决定每一个具体 Blob 的颜色。

| 碎片情绪 | 对应关键词 | 固定色码池 (Array) |
| :--- | :--- | :--- |
| **愈疗蓝/绿** | 舒畅、自然、安静 | `["#22D3EE", "#38BDF8", "#4ADE80", "#86EFAC"]` |
| **能量橙/黄** | 兴奋、开心、心流 | `["#FBBF24", "#F59E0B", "#F97316", "#FDE68A"]` |
| **沉思紫/灰** | 思考、疲倦、无奈 | `["#C084FC", "#D8B4FE", "#A855F7", "#F3E8FF"]` |
| **波动粉/红** | 难过、焦虑、感性 | `["#F472B6", "#FB7185", "#EC4899", "#FBCFE8"]` |

### 5.3 视觉应用规则
1.  **独立映射**: 前端根据 `daily_status.emoji` 渲染 Header；根据 `blobs[i].label` 或后端下发的 `color` 渲染每个圆球。
2.  **色彩共存**: 允许在"蓝色治愈系"的 Header 下出现"橙色能量"的 Blob（例如：在平静的一天里突然发生了一件开心的事）。
3.  **Header 动态底色**: 前端根据后端返回的 `emoji` 字段，匹配上述映射表，动态修改 `.home-header` 的 `background` 样式。
4.  **Blob 颜色锁定**: 每一个 `blob` 对象在创建时应分配合理的颜色值（由后端存储或前端根据标签生成），颜色建议从上述 6-8 种固定色值中选取，以保证全屏视觉的和谐度。
5.  **过渡动画**: 当用户切换日期时，Header 背景色应有 `0.5s` 的平滑过渡效果。

---

## 6. 技术实现细节

### 6.1 语音输入 (Voice Input)
- **技术栈**: Web Speech API (`SpeechRecognition`)
- **支持场景**: Onboarding 输入框、Chat 输入框
- **交互方式**: 长按麦克风按钮开始录音，松开停止
- **实时反馈**: 
  - 音量可视化（基于 `AudioContext` 和 `AnalyserNode`）
  - 实时转写文本显示在输入框中
- **语言设置**: `zh-CN` (简体中文)

### 6.2 物理引擎 (Jar Physics)
- **实现方式**: 自定义 2D 物理引擎，模拟重力、碰撞、边界反弹
- **性能优化**: 
  - 使用 `requestAnimationFrame` 进行动画循环
  - 碰撞检测仅在 Blob 之间和 Blob 与边界之间进行
- **参数调优**: 
  - 重力: `0.15`
  - 阻尼: `0.98`
  - 碰撞弹性: `0.7`

### 6.3 Flutter WebView 集成
- **架构**: H5 页面将嵌套在 Flutter 的 WebView 中
- **通信方式**: 预留 `JavaScriptChannel` 接口，用于 H5 与 Flutter 的双向通信
- **推送通知**: 
  - Demo 阶段使用应用内模拟推送（`position: absolute` 定位在容器内）
  - 生产环境可通过 Flutter 层实现真实系统推送，H5 通过 `JavaScriptChannel` 接收通知数据

---

## 7. 后端 API 汇总

### 7.1 核心接口列表

| `/api/auth/login` | POST | 手机号登录/注册 | `{ phoneNumber }` | `{ userId, token, profile: { daysWithMochi } }` |
| `/api/timeline` | GET | 获取日期时间轴 | - | `[{ id, label, hasRecords }]` |
| `/api/daily_status` | GET | 获取单日详情 | `dateId` | `{ id, dateStr, emoji, blobs[], ... }` |
| `/api/chat/sessions` | GET | 获取所有对话会话 | - | `[{ sessionId, timestamp, messages[], ... }]` |
| `/api/chat/send` | POST | 发送用户消息并获取 AI 回复 | `{ sessionId, message }` | `{ aiReply }` |
| `/api/blobs` | POST | 创建新的情绪碎片 | `{ label, note, source, color }` | `{ id, ... }` |
| `/api/blobs/{id}` | PATCH | 更新碎片状态 | `{ isDiscussed }` | `{ success }` |
| `/api/notifications/suggest` | GET | 获取推荐推送的 Blob | - | `{ blobId, title, body }` |

### 7.2 LLM Prompt 需求汇总

**需求点 #1: Chat Session 回复生成**
- 位置: `/api/chat/send`
- Prompt 模板: `[待补充]`

**需求点 #2: 推送通知文案生成**
- 位置: `/api/notifications/suggest`
- Prompt 模板: `[待补充]`

**需求点 #3: 情绪标签提取 (可选)**
- 位置: `/api/blobs` (创建时自动提取 `label`)
- 输入: 用户输入的 `note` 文本
- 输出: 简短的情绪关键词 (如 "焦虑", "开心", "疲惫")
- Prompt 模板: `[待补充]`

**需求点 #4: 每日摘要生成 (可选)**
- 位置: `/api/daily_status` (生成 `statusText`)
- 输入: 当日所有 Blob 的 `label` 和 `note`
- 输出: 一句温暖的每日总结文案
- Prompt 模板: `[待补充]`

---

## 8. 部署与环境

### 8.1 前端
- **技术栈**: React + Framer Motion + Web Speech API
- **构建工具**: Vite
- **部署方式**: 静态资源部署 / 嵌入 Flutter WebView

### 8.2 后端
- **API 风格**: RESTful
- **认证方式**: 手机号登录（Demo 阶段仅前端模拟）
- **数据存储**: 需持久化用户的 Blobs、Sessions、讨论状态等

---

## 9. 未来扩展方向

1. **真实设备集成**: 连接 Mochi Ring 和 Mochi Soft 硬件设备，实时同步生理数据
2. **情绪趋势分析**: 基于历史 Blobs 生成情绪曲线图
3. **多模态输入**: 支持图片、语音片段作为情绪碎片的附件
4. **社交功能**: 允许用户分享特定的情绪碎片给朋友或家人
