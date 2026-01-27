# Mochi Demo 2.0 需求说明书 (PRD)

本档根据当前最新的 Demo 实现（2.0 版本）进行反向推导编写，旨在清晰定义前端逻辑、交互细则以及后端对接所需的数据结构。

---

## 1. 核心业务价值
Mochi 定位于“情绪伴侣”，通过轻量化的碎片记录（Emotion Blobs）和适时的深度交流（Session-based Chat），为用户提供无压力的情绪排解空间。其核心在于 **“分段式存档”** 与 **“时效性反馈”**。

## 2. 页面逻辑与数据定义

### 2.1 情绪首页 (Home Page)
首页以“情绪罐头”为核心视觉符号，承载日度的情绪汇总。

#### 核心交互逻辑：
- **日期滚动 (Date Roller)**: 
  - 支持横向左右滑动查看历史日期。
  - **有记录状态**: 如果该日期包含 `hasRecords: true`，则颜色加深且可点击切换。
  - **无记录状态**: 如果该日期无数据，则置灰且禁用（不可点击）。
- **物理互动 (Jar Physics)**: 界面根据当日情绪碎片（Blobs）的数量和类型（颜色/大小）动态渲染物理碰撞效果。
- **主动记录 (Manual Entry)**: 点击右下角 `+` 号开启引导流程，录入情绪后生成新的 Blob。

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
| `whisper.text` | String | 深度观察文本 | (预留字段) 暂不直接显示 |

---

### 2.2 聊天页面 (Chat Page - Multi-Session)
聊天室不再是单一的无限流，而是基于“阶段（Session）”进行管理的。

#### 核心交互逻辑：
- **三段式布局 (Tiered Layout)**:
  1. **历史追溯**: 最上方展示已褪色的历史对话（Opacity 0.5）。
  2. **封存节点 (End Card)**: 当一个会话结束，出现的总结卡片。卡片上方伴随“已封存于 [Timestamp]”的标识。
  3. **活跃会话 (Active Session)**: 每一个新的“聊聊这个瞬间”点击，都会开启一个带有独立时间戳的新 Block。
- **自动对焦**: 进入 Chat 页面或产生新内容时，强制滚动到最下方的最新 Block（考虑 600ms 动画延迟）。
- **实时模拟**: 输入框发送后追加到最新的 Session 消息队列中，并触发模拟 AI 回复。

#### 后端数据需求 (GET /api/chat/sessions):
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `sessionId` | String | 会话唯一 ID |
| `timestamp` | String | 该会话开启的精确时间 |
| `messages` | Array | `[{ type: 'ai'/'user', text: string }]` 会话内的消息流 |
| `isClosed` | Boolean | 该会话是否已生成 End Card 并封存 |
| `endCardContent`| String | (可选) 如果已封存，对应的总结语内容 |

---

### 2.3 设备与配对 (Device Page)
简易的设备状态管理页面。

#### 核心交互逻辑：
- 扫描、配对流程的 UI 演示。
- 数据仅需状态标记（已连接/离线）。

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
  "source": "manual / chat / auto"
}
```

### 3.2 Chat Session (对话会话)
```json
{
  "id": "unique_id",
  "timestamp": "2025/12/2 · 4:40 PM",
  "messages": [
    { "type": "ai", "text": "..." },
    { "type": "user", "text": "..." }
  ]
}
```

---

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
2.  **色彩共存**: 允许在“蓝色治愈系”的 Header 下出现“橙色能量”的 Blob（例如：在平静的一天里突然发生了一件开心的事）。

### 5.2 视觉应用规则
1.  **Header 动态底色**: 前端根据后端返回的 `emoji` 字段，匹配上述映射表，动态修改 `.home-header` 的 `background` 样式。
2.  **Blob 颜色锁定**: 每一个 `blob` 对象在创建时应分配合理的颜色值（由后端存储或前端根据标签生成），颜色建议从上述 6-8 种固定色值中选取，以保证全屏视觉的和谐度。
3.  **过渡动画**: 当用户切换日期时，Header 背景色应有 `0.5s` 的平滑过渡效果。
