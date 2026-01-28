# Mochi Demo 2.0 后端接口文档（给后端参考）

> 来源：`MOCHI_DEMO_PRD_REVERSED.md` + `src/App.jsx` 的实现逻辑汇总  
> 目标：对齐 Demo 所需接口与数据结构（非生产规格）

---

## 0. 约定

- Base URL：`/api`
- 时间格式：`YYYY/MM/DD · HH:mm`（如 `2025/12/2 · 4:40 PM`）
- 所有返回默认 `200`，失败用 `4xx/5xx`（Demo 可简化）
- 认证：Demo 阶段可返回 mock token

---

## 1. 账号系统

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
    "daysWithMochi": 12
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
  "emoji": "😇",
  "statusTitle": "今日状态",
  "statusText": "情绪起起伏伏，但你始终能把自己接住",
  "whisper": { "icon": "sparkles", "text": "听起来你现在需要一点安静的空间..." },
  "events": [
    { "text": "🎧 随口记了一句有点累" },
    { "text": "⚡️ 工作中有点不舒服" },
    { "text": "🍜 后来慢慢安静下来" }
  ],
  "blobs": [
    {
      "id": "blob_1",
      "r": 42,
      "color": "#F7AC52",
      "label": "心跳加速",
      "time": "12:20",
      "note": "刚刚发生的事情…",
      "source": "manual",
      "isDiscussed": false
    }
  ]
}
```

**字段说明**
- `emoji`：用于 Header 渐变映射
- `statusTitle`/`statusText`：白色胶囊卡片
- `whisper.icon`：前端图标 key（如 `sparkles` / `radio`）
- `blobs[].isDiscussed`：已讨论状态（影响视觉）

---

## 3. 情绪碎片（Blobs）

### 3.1 创建情绪碎片
`POST /api/blobs`

**请求**
```json
{
  "label": "新记录",
  "note": "今天有点乱…",
  "source": "manual",
  "color": "#F472B6"
}
```

**响应**
```json
{
  "id": "blob_123",
  "r": 40,
  "color": "#F472B6",
  "label": "新记录",
  "time": "14:32",
  "note": "今天有点乱…",
  "source": "manual",
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
    "timestamp": "2025/12/2 · 4:40 PM",
    "messages": [
      { "type": "ai", "text": "嗨，我是 Mochi。" },
      { "type": "user", "text": "今天有点累" }
    ],
    "isClosed": false,
    "endCardContent": null,
    "relatedBlobId": "blob_123"
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

> 备注：前端当前为本地 mock，后端可返回单条 AI 回复文本

---

## 5. 推送提示（模拟）

### 5.1 获取推荐推送内容
`GET /api/notifications/suggest`

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

## 6. 数据模型（简版）

### 6.1 EmotionBlob
```json
{
  "id": "string",
  "r": 40,
  "color": "#F472B6",
  "label": "情绪关键词",
  "time": "HH:mm",
  "note": "文字内容",
  "source": "manual|chat|auto",
  "isDiscussed": false
}
```

### 6.2 ChatSession
```json
{
  "sessionId": "string",
  "timestamp": "YYYY/MM/DD · HH:mm",
  "messages": [{ "type": "ai|user", "text": "..." }],
  "isClosed": false,
  "endCardContent": "可选",
  "relatedBlobId": "可选"
}
```

### 6.3 UserProfile
```json
{
  "userId": "string",
  "phoneNumber": "string",
  "phoneSuffix": "string",
  "avatar": "string",
  "daysWithMochi": 12
}
```

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

