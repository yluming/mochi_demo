# Mochi API 接口文档

## 概述

- **Base URL**: `http://localhost:{port}`（默认端口 2026）
- **Content-Type**: `application/json; charset=utf-8`
- **错误响应格式**（非 2xx 时）: `{"error": "错误信息"}`

---

## 认证说明

部分接口需要鉴权，在请求头中携带：

```
Authorization: Bearer <token>
```

登录成功后返回的 `token` 字段即为所需 token。

---

## 1. 用户认证

### 1.1 注册

**POST** `/user/register`

**请求体**

```json
{
  "username": "用户名",
  "password": "密码"
}
```

| 字段     | 类型   | 必填 | 说明     |
|----------|--------|------|----------|
| username | string | 是   | 用户名   |
| password | string | 是   | 密码     |

**成功响应**（200）

```json
{
  "code": 0,
  "msg": "success"
}
```

**错误响应**

| 状态码 | 说明                             |
|--------|----------------------------------|
| 400    | invalid body / username and password required / 用户名已注册 / 密码需包含数字、小写字母、大写字母 |
| 403    | 注册已关闭                       |
| 405    | method not allowed               |
| 500    | 内部错误                         |

---

### 1.2 登录

**POST** `/user/login`

**请求体**

```json
{
  "username": "用户名",
  "password": "密码"
}
```

| 字段     | 类型   | 必填 | 说明     |
|----------|--------|------|----------|
| username | string | 是   | 用户名   |
| password | string | 是   | 密码     |

**成功响应**（200）

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "token": "登录成功后返回的 token，用于后续鉴权",
    "expire": 604800,
    "clientHash": ""
  }
}
```

| 字段       | 类型   | 说明                          |
|------------|--------|-------------------------------|
| token      | string | 鉴权 token，需在请求头中携带  |
| expire     | int    | 过期时间（秒），默认 7 天     |
| clientHash | string | 可选，客户端哈希              |

**错误响应**

| 状态码 | 说明                             |
|--------|----------------------------------|
| 400    | invalid body / username and password required |
| 401    | 用户名或密码错误                 |
| 405    | method not allowed               |
| 500    | 内部错误                         |

---

### 1.3 用户统计（需鉴权）

用户统计（累计登录次数、累计使用时长、最近登录时间）的 **增改完全由本小节接口实现**，登录接口 `/user/login` 不会自动更新统计。前端在登录成功后需调用「上报登录」接口记录本次登录。

以下接口需在请求头中携带：`Authorization: Bearer <token>`。

#### 1.3.1 获取用户统计

**GET** `/user/stats`

返回当前用户的累计登录次数、累计使用时长（分钟）、最近一次登录时间，用于前端展示。

**成功响应**（200）

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "login_count": 10,
    "usage_minutes": 120,
    "last_login_at": "2026-02-02T10:00:00+08:00"
  }
}
```

| 字段          | 类型    | 说明                     |
|---------------|---------|--------------------------|
| login_count   | int     | 累计登录次数             |
| usage_minutes | int     | 累计使用时长（分钟）     |
| last_login_at | string  | 最近一次登录时间（ISO8601），可为 null |

**错误响应**

| 状态码 | 说明             |
|--------|------------------|
| 401    | missing authorization / unauthorized |
| 404    | user not found   |
| 500    | 内部错误         |

#### 1.3.2 上报登录（埋点）

**POST** `/user/stats/login`

前端埋点上报本次登录。服务端将当前用户的累计登录次数 +1，并将最近登录时间更新为当前时间。**建议在调用 `/user/login` 成功并拿到 token 后立即调用本接口**（请求头携带该 token）。

**请求体**：无，或空对象 `{}`。

**成功响应**（200）

```json
{
  "code": 0,
  "msg": "success"
}
```

**错误响应**

| 状态码 | 说明             |
|--------|------------------|
| 401    | missing authorization / unauthorized |
| 405    | method not allowed |
| 500    | 内部错误         |

#### 1.3.3 上报使用时长（埋点）

**POST** `/user/stats/usage`

前端埋点上报本段使用时长（分钟），服务端会累加到该用户的累计使用时长。建议在应用切到后台或定时（如每 5 分钟）上报一次。

**请求体**

```json
{
  "minutes": 5
}
```

| 字段    | 类型 | 必填 | 说明                 |
|---------|------|------|----------------------|
| minutes | int  | 是   | 本段使用时长（分钟） |

**成功响应**（200）

```json
{
  "code": 0,
  "msg": "success"
}
```

**说明**：若 `minutes` ≤ 0，接口直接返回成功，不更新数据。

**错误响应**

| 状态码 | 说明             |
|--------|------------------|
| 400    | invalid body     |
| 401    | missing authorization / unauthorized |
| 405    | method not allowed |
| 500    | 内部错误         |

---

## 2. 情绪碎片（Emotion Blobs）

以下接口均需鉴权：`Authorization: Bearer <token>`。

### 2.1 创建情绪碎片

**POST** `/emotion-blobs`

**请求体**

```json
{
  "content": "情绪内容文本",
  "source": "手动记录"
}
```

| 字段    | 类型   | 必填 | 说明                                                                 |
|---------|--------|------|----------------------------------------------------------------------|
| content | string | 是   | 情绪内容文本                                                         |
| source  | string | 否   | 来源，可选：`手动记录`、`对话提取`、`录音记录`。当前标题/分类生成仅支持 `手动记录` |

**成功响应**（201）

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": "uuid",
    "user_id": 1,
    "title": "情绪关键词标题",
    "created_at": "2026-02-02T10:00:00Z",
    "content": "情绪内容文本",
    "source": "手动记录",
    "category": "愈疗蓝/绿",
    "color": "#22D3EE",
    "is_discussed": false
  }
}
```

| 字段         | 类型    | 说明                                                         |
|--------------|---------|--------------------------------------------------------------|
| id           | string  | 情绪碎片 ID                                                  |
| user_id      | int64   | 用户 ID                                                      |
| title        | string  | 标题（由 LLM 生成的情绪关键词，最多 15 字）                   |
| created_at   | string  | 创建时间，RFC3339                                            |
| content      | string  | 原始内容                                                     |
| source       | string  | 来源：手动记录 / 对话提取 / 录音记录                          |
| category     | string  | 情绪分类：愈疗蓝/绿、能量橙/黄、沉思紫/灰、波动粉/红           |
| color        | string  | 该类别下的随机色值（如 #22D3EE）                              |
| is_discussed | boolean | 是否已讨论                                                   |

**错误响应**

| 状态码 | 说明                                                             |
|--------|------------------------------------------------------------------|
| 400    | invalid body / content required / source 必须为 手动记录/对话提取/录音记录 之一 / 该来源的标题/分类提取尚未配置 |
| 401    | unauthorized / missing authorization / invalid authorization     |
| 405    | method not allowed                                               |
| 500    | 内部错误 / LLM 空响应等                                          |

---

### 2.2 获取有碎片的日期列表

**GET** `/emotion-blobs/dates?from={from}&to={to}`

| 参数  | 类型   | 必填 | 说明                        |
|-------|--------|------|-----------------------------|
| from  | string | 是   | 起始日期，RFC3339 格式      |
| to    | string | 是   | 结束日期，RFC3339 格式      |

**成功响应**（200）

```json
{
  "code": 0,
  "msg": "success",
  "data": ["2026-02-01T00:00:00Z", "2026-02-02T00:00:00Z"]
}
```

`data` 为在 `from`～`to` 范围内有情绪碎片的日期列表（RFC3339，当日 00:00:00 UTC）。

**错误响应**

| 状态码 | 说明                                         |
|--------|----------------------------------------------|
| 400    | from and to required (RFC3339) / from: invalid RFC3339 / to: invalid RFC3339 |
| 401    | unauthorized                                 |
| 405    | method not allowed                           |
| 500    | 内部错误                                     |

---

### 2.3 按日期获取情绪碎片列表

**GET** `/emotion-blobs?date={date}`

| 参数  | 类型   | 必填 | 说明                   |
|-------|--------|------|------------------------|
| date  | string | 是   | 查询日期，RFC3339 格式 |

**成功响应**（200）

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "blobs": [
      {
        "id": "uuid",
        "user_id": 1,
        "title": "情绪关键词",
        "created_at": "2026-02-02T10:00:00Z",
        "content": "内容",
        "source": "手动记录",
        "category": "愈疗蓝/绿",
        "color": "#22D3EE",
        "is_discussed": false
      }
    ],
    "dailySummary": {
      "emotions": "当日情绪总结文本",
      "events": "当日事件总结文本"
    }
  }
}
```

| 字段           | 类型   | 说明                                           |
|----------------|--------|------------------------------------------------|
| blobs          | array  | 该日期的情绪碎片列表，结构同 2.1 创建响应       |
| dailySummary   | object | 可选，当日情绪碎片总结（凌晨 4 点定时生成）     |
| dailySummary.emotions | string | 情绪总结                                     |
| dailySummary.events   | string | 事件总结                                     |

**错误响应**

| 状态码 | 说明                             |
|--------|----------------------------------|
| 400    | date required (RFC3339) / date: invalid RFC3339 |
| 401    | unauthorized                     |
| 405    | method not allowed               |
| 500    | 内部错误                         |

---

## 3. 聊天（Chat）

以下接口均需鉴权：`Authorization: Bearer <token>`。

### 3.1 创建聊天会话

**POST** `/chat/sessions`

**请求体**：无（或空对象 `{}`）

**成功响应**（201）

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": "session-uuid",
    "user_id": 1,
    "created_at": "2026-02-02T10:00:00Z",
    "updated_at": "2026-02-02T10:00:00Z",
    "is_ended": false,
    "summary": "",
    "emotion_blob_ids": []
  }
}
```

| 字段             | 类型   | 说明                    |
|------------------|--------|-------------------------|
| id               | string | 会话 ID                 |
| user_id          | int64  | 用户 ID                 |
| created_at       | string | 创建时间，RFC3339       |
| updated_at       | string | 更新时间，RFC3339       |
| is_ended         | bool   | 是否已结束              |
| summary          | string | 会话摘要                |
| emotion_blob_ids | array  | 关联的情绪碎片 ID 列表  |

**错误响应**

| 状态码 | 说明             |
|--------|------------------|
| 401    | unauthorized     |
| 405    | method not allowed |
| 500    | 内部错误         |

---

### 3.2 分页获取聊天会话列表

**GET** `/chat/sessions?page={page}`

| 参数  | 类型   | 必填 | 说明                        |
|-------|--------|------|-----------------------------|
| page  | int    | 否   | 页码，从 1 开始，默认 1      |

**成功响应**（200）

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "sessions": [
      {
        "id": "session-uuid",
        "user_id": 1,
        "created_at": "2026-02-02T10:00:00Z",
        "updated_at": "2026-02-02T10:00:00Z",
        "is_ended": false,
        "summary": "",
        "emotion_blob_ids": []
      }
    ],
    "total": 25,
    "page": 1,
    "pageSize": 10
  }
}
```

| 字段       | 类型   | 说明                              |
|------------|--------|-----------------------------------|
| sessions   | array  | 当前页的会话列表，结构同 3.1 创建响应 |
| total      | int64  | 当前用户会话总数                  |
| page       | int    | 当前页码                          |
| pageSize   | int    | 每页条数，固定 10                 |

**错误响应**

| 状态码 | 说明             |
|--------|------------------|
| 401    | unauthorized     |
| 405    | method not allowed |
| 500    | 内部错误         |

---

### 3.3 根据会话 ID 获取消息列表

**GET** `/chat/sessions/{sessionId}/messages`

| 路径参数   | 类型   | 说明        |
|------------|--------|-------------|
| sessionId  | string | 聊天会话 ID |

**成功响应**（200）

```json
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "id": "msg-uuid",
      "chat_session_id": "session-uuid",
      "type": "user",
      "content": "用户发送的原文",
      "created_at": "2026-02-02T12:00:00Z"
    },
    {
      "id": "msg-uuid",
      "chat_session_id": "session-uuid",
      "type": "ai",
      "content": "模型回复内容",
      "created_at": "2026-02-02T12:00:01Z"
    }
  ]
}
```

| 字段           | 类型   | 说明                                    |
|----------------|--------|-----------------------------------------|
| id             | string | 消息 ID                                 |
| chat_session_id| string | 所属会话 ID                             |
| type           | string | 消息类型：`user` / `ai`                 |
| content        | string | 消息内容（user 为原文，ai 为模型回复）   |
| created_at     | string | 创建时间，RFC3339                       |

**说明**：接口不返回 `prompt` 字段（仅内部用于发给模型的完整提示）。

**错误响应**

| 状态码 | 说明                             |
|--------|----------------------------------|
| 400    | sessionId required              |
| 401    | unauthorized                     |
| 403    | forbidden（非会话拥有者）        |
| 404    | session not found                |
| 405    | method not allowed               |
| 500    | 内部错误                         |

---

### 3.4 发送消息（流式 SSE）

**POST** `/chat/messages`

**请求体**

```json
{
  "sessionId": "session-uuid",
  "message": "用户输入的消息",
  "emotionBlobIds": ["blob-id-1", "blob-id-2"]
}
```

| 字段            | 类型   | 必填 | 说明                           |
|-----------------|--------|------|--------------------------------|
| sessionId       | string | 是   | 聊天会话 ID                    |
| message         | string | 是   | 用户消息文本                   |
| emotionBlobIds  | array  | 否   | 关联的情绪碎片 ID，用于上下文  |

**成功响应**（200）

流式返回，`Content-Type: text/event-stream`，SSE 事件格式：

```
data: {"content":"一段文本内容"}

data: {"content":"下一段文本"}
```

客户端解析 `data:` 后的 JSON，取 `content` 字段拼接到完整回复。

**错误响应**（在流开始前返回）

| 状态码 | 说明                             |
|--------|----------------------------------|
| 400    | invalid body / sessionId required / message required |
| 401    | unauthorized                     |
| 403    | forbidden（非会话拥有者）         |
| 404    | session not found                |
| 405    | method not allowed               |
| 500    | 内部错误 / streaming not supported |

**说明**：流式传输开始后若发生错误，仅会中断流，不会再返回新的 HTTP 错误体。

---

## 附录

### 情绪碎片来源（source）

| 值       | 说明     |
|----------|----------|
| 手动记录 | 用户手动录入，支持标题/分类 LLM 生成 |
| 对话提取 | 从对话中提取，当前不支持 LLM 标题/分类 |
| 录音记录 | 录音转写，当前不支持 LLM 标题/分类   |

### 情绪碎片分类（category）

| 值         | 说明     |
|------------|----------|
| 愈疗蓝/绿  | 治愈、平和类 |
| 能量橙/黄  | 活力、积极类 |
| 沉思紫/灰  | 思考、冷静类 |
| 波动粉/红  | 波动、激烈类 |

### 日期格式

所有日期参数及返回值均使用 **RFC3339** 格式，例如：

- `2026-02-02T00:00:00Z`
- `2026-02-02T10:30:00+08:00`
