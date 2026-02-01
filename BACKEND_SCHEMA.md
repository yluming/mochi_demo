# Mochi Backend Data Schema (Entity-First)

本文档旨在为后端开发提供纯粹的数据模型定义，忽略具体的业务逻辑示例，重点解决“有哪些实体”以及“实体包含哪些字段”的问题。

---

## 1. 用户实体 (User Profile)
描述用户账号及基础属性。

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `userId` | String | 用户唯一 ID |
| `username` | String | 完整手机号 (作为账号标识符) |
| `phoneSuffix` | String | 手机后四位 |
| `avatar` | String | 头像 URL |
| `createdAt` | String | 账号创建时间 (RFC3339) |
| `daysWithMochi` | Number | 累计使用天数 |
| `loginCount` | Number | 累计登录次数 |
| `totalUsageMinutes` | Number | 累计使用时长 (分钟) |
| `lastLoginAt` | String | 最近一次登录时间 (RFC3339) |
| `token` | String | 会话身份凭证 |

---

## 2. 每日状态实体 (Daily Status / Day)
描述每一天的容器状态及汇总信息。

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `userId` | String | 所属用户 ID |
| `id` | String | 唯一标识 (如 `today`, `tue5`) |
| `label` | String | 时间轴简写标签 (如 `Today`, `Wed 6`) |
| `dateStr` | String | 完整日期文案 (如 `2025年11月9日`) |
| `fullDate` | String | 机器识别日期 (RFC3339，仅日期部分或零点) |
| `hasRecords` | Boolean | 当日是否有任何记录 (决定时间轴圆点亮灭) |
| `emoji` | String | 当日主情绪 Emoji (影响 Header 渐变色) |
| `statusText` | String | 首页展示的今日总结文案 |
| `archiveLabel`| Object | 历史视图中显示的档案标签 |
| `archiveLabel.emotions`| String | 情绪标签 (如 "#疲惫 #烦躁→平静") |
| `archiveLabel.events`| String | 事件关键词 (如 "加班 | 深夜散步 | 放空") |
| `whisper` | Object | Mochi 的私语建议 (目前仅含 `{ "text": "..." }`) |

---

## 3. 情绪碎片实体 (Emotion Blob)
描述用户录入或自动生成的具体碎片。

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `userId` | String | 所属用户 ID |
| `id` | String | 碎片唯一 ID |
| `sentimentTag` | String | 情绪分类 (PRD 规范: `愈疗蓝/绿`, `能量橙/黄`, `沉思紫/灰`, `波动粉/红`) |
| `label` | String | 情绪关键词/标题 |
| `time` | String | 产生时间 (RFC3339) |
| `note` | String | 用户录入或转录的详细文本 |
| `source` | Enum | 来源: `手动记录` (App内打字/语音)、`对话提取` (聊天总结)、`录音记录` (戒指录音) |
| `isDiscussed` | Boolean | 标记该碎片是否已被讨论 (影响视觉光晕) |
| `isUnread` | Boolean | **[MOCK]** 标记该碎片是否为用户未读的新增内容 (影响首页 Ripple 动效) |

---

## 4. 聊天会话实体 (Chat Session)
描述一次完整的对话记录。

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `userId` | String | 所属用户 ID |
| `sessionId` | String | 会话唯一 ID |
| `startTime` | String | 会话开始时间 (RFC3339) |
| `isClosed` | Boolean | 会话是否已结束并生成了总结卡片 |
| `closedAt` | String | 会话封存时间 (RFC3339) |
| `endCardContent`| String | 会话结束后展示的结语总结文案 |
| `relatedBlobIds` | Array | (可选) 开启或关联至此会话的碎片 ID 列表 |

---

## 5. 聊天消息实体 (Message)
描述会话中的单条对话条目。

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `sessionId` | String | 所属会话 ID |
| `type` | Enum | 发送方: `ai` 或 `user` |
| `text` | String | 消息的具体文本内容 |
| `show_text` | String | 用户真实前端展示文本 |
| `timestamp` | String | 消息发送时间 (RFC3339) |

---

## 6. 推送建议实体 (Notification Suggestion)
描述后端主动推送的引导文案。

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `blobId` | String | 目标 EmotionBlob 的 ID |
| `title` | String | 通知标题 (引导) |
| `body` | String | 通知正文 (共情引导文案) |

---

## 7. 用户活跃/使用记录 (User Activity Log)
用于监控用户每次的使用时长及行为。

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `logId` | String | 记录唯一 ID |
| `userId` | String | 用户 ID |
| `logType` | Enum | `login` (登录) 或 `active` (仅唤醒/切回) |
| `startTime` | String | 进入 App / 登录的时间 |
| `endTime` | String | 退出/切后台时间 |
| `duration` | Number | 单次停留时长 (秒) |
| `deviceInfo` | String | 设备信息 (如 "iOS 17.5") |

---

## 8. 约定与状态映射关系

### 7.1 Emoji 与背景颜色映射 (前端逻辑参考)
### 8.1 Emoji 与视觉映射约定 (Backend Signaling vs. Frontend Visuals)
- **后端职责**：随机或通过算法（如心情分析）在 `DailyStatus` 中返回一个 `emoji` 字符。该字符是状态的唯一信号。
- **前端职责**：维护一套映射表，根据 `emoji` 映射对应的 Header 渐变色及 Blob 颜色池。
- **映射关系参考**：
  - `😇`, `😌`, `🌿` -> 蓝绿治愈系
  - `🤩`, `⚡️` -> 橙黄能量系
  - `😴`, `🧘‍♂️` -> 紫色沉思系
  - `default` -> 红色敏感系

### 7.2 碎片 (Blob) 状态
- **新增**: 调用 `POST /api/blobs`。
- **标记已讨论**: 进行对话后，后端需将对应 `id` 的 `isDiscussed` 设为 `true`。
### 8.3 会话自动关闭 (Inactivity Timeout)
- **触发点**：前端计时 10 分钟无用户输入。
- **动作**：前端发起 `PATCH /api/chat/sessions/{id}/close` 请求。
- **后端配合**：在该请求中完成最终的内容摘要、情绪识别和结语生成。

### 8.5 会话开启抢占逻辑 (Session Preemption)
- **规则**：同一时间内，用户仅能拥有一个“活跃” (`isClosed: false`) 的会话。
- **触发逻辑**：当用户从一个新的情绪碎片点击“聊聊这个瞬间”时，若当前存在未关闭会话，前端应**先行调用关闭接口**结算旧会话，再开启新会话。
- **关联设计**：会话实体使用 `relatedBlobIds` (Array) 存储关联的碎片，为未来“一聊多球”留出扩展空间。

### 8.4 时间处理约定 (Time Formatting Strategy)
- **后端职责**：所有接口统一返回 `RFC3339` 标准格式（如 `2025-11-09T14:32:00Z`）。这确保了时区处理的严谨性和跨平台一致性。
- **前端职责**：前端负责将 RFC3339 字符串转换为用户可读的视觉格式（如 `14:32` 或 `2025年11月9日`）。
- **转换参考**：
  - `time` (Blob) -> 展示为 `HH:mm` (24小时制)
  - `dateStr` (DailyStatus) -> 展示为 `YYYY年MM月DD日`
  - `startTime/closedAt` (Session) -> 展示为 `YYYY/MM/DD · HH:mm`

### 8.6 主动推送触发约定 (Proactive Notification)
- **触发时间**：每日晚间 20:00 (Local Time)。
- **触发逻辑**：前端在指定时间（或通过定时器/推送服务注入）发起请求。
- **传递参数**：前端需过滤出当日所有 `isDiscussed: false` 的碎片 ID。
- **空值处理**：若当日无任何碎片，参数应传 `null` 或空数组，由后端决定是否返回空或者是通用的问候语。
