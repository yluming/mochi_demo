# Mochi Demo 2.0 后端接口文档（给后端参考）

> 来源：`MOCHI_DEMO_PRD_REVERSED.md` + `src/App.jsx` 的实现逻辑汇总  
> 目标：对齐 Demo 所需接口与数据结构（非生产规格）

---

## 0. 约定

- Base URL：`/api`
- 时间格式：**RFC3339** (如 `2025-12-02T16:40:00Z` 或 `2025-12-02T16:40:00+08:00`)
- **展示转换约定**：后端始终返回 RFC3339 机器时间。前端负责根据业务场景将其格式化为用户可读的文案（如 `9:41 AM` 或 `2025年11月9日`）。
- 所有返回默认 `200`，失败用 `4xx/5xx`（Demo 可简化）
- 认证：Demo 阶段使用 `Authorization: Bearer <token>` 请求头。
- **身份标识约定**：虽然数据库实体中包含 `userId`，但 **API 请求体中通常不需要包含 `userId`**。后端会从 Token 中解出当前操作的 `userId`，以确保数据安全（防止越权）。

---

## 1. 认证与账号

### 1.1 手机号登录
`POST /api/auth/login`

**请求**
```json
{
  "phoneNumber": "13800003721"
}
```

**响应**
```json
{
  "userId": "user_123",
  "token": "demo_token",
  "profile": {
    "phoneNumber": "13800003721",
    "phoneSuffix": "3721",
    "avatar": "https://...",
    "createdAt": "2025-11-01T00:00:00Z",
    "daysWithMochi": 12,
    "loginCount": 42
  }
}
```

---

## 2. 首页与时间轴

### 2.1 时间轴概览
`GET /api/timeline`

**响应**
```json
[
  { "id": "tue5", "label": "Tue 5", "hasRecords": false },
  { "id": "wed6", "label": "Wed 6", "hasRecords": true },
  { "id": "today", "label": "Today", "hasRecords": true }
]
```

### 2.2 单日详情
`GET /api/daily_status?dateId={id}`

**响应**
```json
{
  "id": "today",
  "label": "Today",
  "dateStr": "2025年11月9日",
  "fullDate": "2025-11-09T00:00:00Z",
  "emoji": "😇",
  "statusText": "情绪起起伏伏，但你始终能把自己接住",
  "whisper": { "text": "听起来你现在需要一点安静的空间..." },
  "archiveLabel": {
    "emotions": "#焦虑 #挫败 #治愈",
    "events": "排期催命 | 被换人 | 猫咪陪伴"
  },
  "blobs": [
      "id": "blob_1",
      "sentimentTag": "能量橙/黄",
      "label": "心跳加速",
      "time": "2025-11-09T12:20:00Z",
      "note": "刚刚发生的事情…",
      "source": "手动记录",
      "isDiscussed": false
    }
  ]
}
```

**字段说明**
| `emoji` | String | 用于 Header 渐变映射 (如 "😇") |
| `statusText` | String | 白色胶囊卡片主文本 |
| `archiveLabel`| Object | 历史档案标签 (包含 `emotions` 和 `events` 字符串) |
| `blobs[].isDiscussed` | Boolean | 已讨论状态 (影响视觉光晕) |

---

## 3. 情绪碎片（Blobs）

### 3.1 创建情绪碎片
`POST /api/blobs`

**请求**
```json
{
  "sentimentTag": "波动粉/红",
  "label": "新记录",
  "note": "今天有点乱…",
  "source": "手动记录"
}
```

**响应**
```json
{
  "id": "blob_123",
  "sentimentTag": "波动粉/红",
  "label": "新记录",
  "time": "2025-11-09T14:32:00Z",
  "note": "今天有点乱…",
  "source": "手动记录",
  "isDiscussed": false
}
```

### 3.2 更新碎片状态
`PATCH /api/blobs/{id}`

**请求**
```json
{ "isDiscussed": true }
```

**响应**
```json
{ "success": true }
```

---

## 4. 聊天会话（Sessions）

### 4.1 获取所有会话
`GET /api/chat/sessions`

**响应**
```json
[
  {
    "sessionId": "s_001",
    "startTime": "2025-11-09T14:40:00Z",
    "messages": [
      { "sessionId": "s_001", "type": "ai", "text": "嗨，我是 Mochi。", "timestamp": "2025-11-09T14:40:01Z" },
      { "sessionId": "s_001", "type": "user", "text": "今天有点累", "timestamp": "2025-11-09T14:42:00Z" }
    ],
    "isClosed": false,
    "endCardContent": null,
    "relatedBlobIds": ["blob_123"]
  }
]
```

### 4.2 发送消息并获取回复
`POST /api/chat/send`

**请求**
```json
{
  "sessionId": "s_001",
  "message": "今天有点累"
}
```

**响应**
```json
{ "aiReply": "我在听。要不要多说一点？" }
```

### 4.3 结束会话并生成结语
`PATCH /api/chat/sessions/{id}/close`

**响应**
```json
{
  "sessionId": "s_001",
  "isClosed": true,
  "closedAt": "2025-11-09T17:15:00Z",
  "endCardContent": "这周的能量稍微低一点也没关系。记得多喝点温水，下午见。"
}
```

> 备注：前端当前为本地 mock，后端可返回单条 AI 回复文本

---

## 5. 推送提示（模拟）

### 5.1 获取推荐推送内容
`POST /api/notifications/suggest`

**请求**
```json
{
  "undiscussedBlobIds": ["blob_123"] 
}
```
> 若当日无任何碎片，则传 `null`

**响应**
```json
{
  "blobId": "blob_123",
  "title": "Mochi 刚才在想...",
  "body": "关于【焦虑】的那个瞬间，想听你多说几句..."
}
```

> 前端点击 banner 会以该 `blobId` 开启新会话，并标记 `isDiscussed`

---

## 6. 使用行为统计 (Analytics)

### 6.1 上报使用时长
`POST /api/analytics/usage`

**请求**
```json
{
  "startTime": "2025/12/2 · 4:40 PM",
  "endTime": "2025/12/2 · 4:55 PM",
  "durationSeconds": 900,
  "deviceInfo": "iPhone 15 Pro, iOS 17.1"
}
```

**响应**
```json
{ "success": true }
```

> 备注：通常在 App 进入后台或用户主动退出时触发。

---

## 7. 数据实体与字段全集 (Data Entity Schema)

后端开发请以此表为准进行数据库建模或数据结构整理。

### 6.1 用户信息 (User/Profile)
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `userId` | String | 用户唯一 ID |
| `phoneNumber` | String | 完整手机号 (用于登录) |
| `phoneSuffix` | String | 手机后四位 (UI 展示用) |
| `avatar` | String | 头像 URL |
| `daysWithMochi` | Number | 注册/使用天数 |
| `token` | String | 会话身份凭证 |

### 6.2 每日状态与时间轴 (DailyStatus/Day)
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | String | 唯一标识 (如 "today", "tue5") |
| `label` | String | 时间轴简写 (如 "Today", "Tue 5") |
| `dateStr` | String | 完整日期文案 (如 "2025年11月9日") |
| `hasRecords` | Boolean | 时间轴是否有记录 (影响呼吸灯点亮) |
| `emoji` | String | 当日心情主 Emoji (影响背景色) |
| `statusText` | String | 首页胶囊卡片主文本 |
| `emotionSummary`| String | (历史模式) 该日的关键总结句 |
| `whisper` | Object | 包含 `text` 的文本对象 |
| `events` | Array | `[{ "text": "..." }]` 历史小票事件列表 |
| `blobs` | Array | 包含 `EmotionBlob` 对象的列表 |

### 6.3 情绪碎片 (EmotionBlob)
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | String | 碎片唯一 ID |
| `r` | Number | 半径/大小 (建议范围 38-45) |
| `color` | String | 十六进制颜色 (如 "#F472B6") |
| `label` | String | 情绪关键词/标题 |
| `time` | String | 捕捉时间 (HH:mm) |
| `note` | String | 详细记录内容 |
| `source` | Enum | 来源: `手动记录` (App内)、`对话提取` (聊天)、`录音记录` (硬件戒指) |
| `isDiscussed` | Boolean | 是否已在聊天中讨论过 (影响视觉光晕) |

### 6.4 聊天会话 (ChatSession)
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `sessionId` | String | 会话唯一 ID |
| `timestamp` | String | 会话开始时间文案 |
| `messages` | Array | 包含 `Message` 对象的列表 |
| `isClosed` | Boolean | 会话是否已结束并生成了 End Card |
| `closedAt` | String | 会话封存时间 (YYYY/MM/DD · HH:mm) |
| `endCardContent`| String | 会话结束后的结语总结文本 |
| `relatedBlobId` | String | 引发该会话的对应碎片 ID (可选) |

### 6.5 聊天消息 (Message)
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `type` | Enum | 发送方: `ai` 或 `user` |
| `text` | String | 消息文本内容 |
| `timestamp` | String | 发送时间 (HH:mm) |

### 6.6 推送建议 (Notification)
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `blobId` | String | 指向的 EmotionBlob ID |
| `title` | String | 横幅标题 |
| `body` | String | 横幅内容 |

---

## 7. LLM 相关（占位）

### 7.1 会话回复生成
`POST /api/chat/send` 内部调用  
输入：当前 session 的 `messages[]` + 可选 `relatedBlob`  
输出：温暖、共情、不下判断的回复文本

### 7.2 推送文案生成
`GET /api/notifications/suggest` 内部调用  
输入：`blob.label` + `blob.note`  
输出：好奇、温柔的提醒文案

---

## 8. 备注（前端依赖点）

- Header 渐变依赖 `emoji` 映射  
- Blob 颜色可由后端锁定并存储  
- `isDiscussed` 影响视觉样式与提示逻辑  

