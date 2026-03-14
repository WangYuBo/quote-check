# 图书引用校对工具 — API 参考文档

**Base URL**: `http://localhost:8000`

**协议**: HTTP/1.1，JSON 响应体，文件上传使用 `multipart/form-data`

**版本**: 0.1.0

---

## 目录

1. [GET /health](#1-get-health)
2. [GET /](#2-get-)
3. [POST /api/proofread](#3-post-apiproofread)
4. [GET /api/result/{task\_id}](#4-get-apiresulttask_id)
5. [错误码说明](#5-错误码说明)
6. [数据结构参考](#6-数据结构参考)

---

## 1. GET /health

### 描述

服务健康检查端点。用于确认服务是否正在运行、依赖项是否正常。

### 请求

```
GET /health
```

无请求参数，无请求体。

### 响应

**200 OK**

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | 服务状态，正常时为 `"ok"` |
| `version` | string | 当前应用版本号 |

### 示例

```bash
curl http://localhost:8000/health
```

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

---

## 2. GET /

### 描述

返回 Web 前端主页（文件上传表单页面）。浏览器访问此地址即可使用可视化操作界面。

### 请求

```
GET /
```

### 响应

**200 OK** — 返回 HTML 页面内容（`Content-Type: text/html`）。

---

## 3. POST /api/proofread

### 描述

上传书稿和参考原文，触发引用校对流程。系统提取书稿中的引用后，调用 Claude API 与参考原文逐条比对，返回完整校对报告或任务 ID（异步模式）。

### 请求

```
POST /api/proofread
Content-Type: multipart/form-data
```

**表单字段**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `manuscript` | File | 是 | 书稿文件，支持 `.docx` / `.pdf` / `.md` / `.txt` |
| `source` | File | 是 | 参考原文文件，支持 `.docx` / `.pdf` / `.md` / `.txt` |

**文件限制**

- 单个文件最大 50 MB（可通过 `MAX_UPLOAD_SIZE_MB` 环境变量调整）
- 仅支持上述四种文件格式，其他格式将返回 400 错误

### 响应

**200 OK** — 校对完成，直接返回报告

```json
{
  "task_id": "a3f2c1d4-5e6f-7890-abcd-ef1234567890",
  "quotes_total": 3,
  "issues_count": 1,
  "error_count": 0,
  "results": [
    {
      "quote": "道可道，非常道",
      "has_issue": false,
      "text_accuracy": {
        "is_accurate": true,
        "issues": "",
        "original_text": "道可道，非常道"
      },
      "interpretation_accuracy": {
        "is_accurate": true,
        "issues": "",
        "suggestion": ""
      },
      "context_appropriateness": {
        "is_appropriate": true,
        "issues": "",
        "suggestion": ""
      },
      "overall_suggestion": "该引用准确，无需修改。"
    },
    {
      "quote": "惚兮恍兮，其中有象",
      "has_issue": true,
      "text_accuracy": {
        "is_accurate": true,
        "issues": "",
        "original_text": "惚兮恍兮，其中有象"
      },
      "interpretation_accuracy": {
        "is_accurate": false,
        "issues": "书稿将"惚恍"解释为"模糊不清"，但王弼注原意强调"无形无象"的本体论含义，与"模糊不清"的感官描述有所差别。",
        "suggestion": "建议将解释修改为：道的状态超越感官，既非有形，又非虚无，是一种超越言说的本源存在。"
      },
      "context_appropriateness": {
        "is_appropriate": true,
        "issues": "",
        "suggestion": ""
      },
      "overall_suggestion": "引用文字准确，但对该句的解释偏向感官层面，建议参考王弼注疏调整表述。"
    }
  ]
}
```

**202 Accepted** — 任务已接受，异步处理中（如服务配置为异步模式）

```json
{
  "task_id": "a3f2c1d4-5e6f-7890-abcd-ef1234567890",
  "status": "processing",
  "message": "校对任务已提交，请通过 GET /api/result/{task_id} 查询结果"
}
```

**响应字段说明（200 模式）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `task_id` | string | 本次校对任务的唯一标识符（UUID） |
| `quotes_total` | integer | 从书稿中提取到的引用总数 |
| `issues_count` | integer | 经核查存在问题的引用条数 |
| `error_count` | integer | 因 API 错误等原因未能完成校对的条数 |
| `results` | array | 每条引用的详细校对结果列表，见[数据结构参考](#6-数据结构参考) |

### 示例

**cURL**

```bash
curl -X POST http://localhost:8000/api/proofread \
  -F "manuscript=@/path/to/manuscript.md" \
  -F "source=@/path/to/source.md"
```

**Python (httpx)**

```python
import httpx

with open("manuscript.md", "rb") as m, open("source.md", "rb") as s:
    response = httpx.post(
        "http://localhost:8000/api/proofread",
        files={
            "manuscript": ("manuscript.md", m, "text/markdown"),
            "source": ("source.md", s, "text/markdown"),
        },
    )

print(response.json())
```

**Python (requests)**

```python
import requests

with open("manuscript.md", "rb") as m, open("source.md", "rb") as s:
    response = requests.post(
        "http://localhost:8000/api/proofread",
        files={
            "manuscript": ("manuscript.md", m),
            "source": ("source.md", s),
        },
    )

print(response.json())
```

---

## 4. GET /api/result/{task\_id}

### 描述

查询指定任务的校对结果。适用于服务以异步模式运行、`POST /api/proofread` 返回 `202` 的场景。

### 请求

```
GET /api/result/{task_id}
```

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `task_id` | string | 是 | 由 `POST /api/proofread` 返回的任务 UUID |

### 响应

**200 OK** — 任务已完成，返回完整校对报告（结构与 `POST /api/proofread` 的 200 响应相同）

```json
{
  "task_id": "a3f2c1d4-5e6f-7890-abcd-ef1234567890",
  "status": "done",
  "quotes_total": 3,
  "issues_count": 1,
  "error_count": 0,
  "results": [ ... ]
}
```

**202 Accepted** — 任务仍在处理中

```json
{
  "task_id": "a3f2c1d4-5e6f-7890-abcd-ef1234567890",
  "status": "processing",
  "message": "任务正在校对中，请稍后再试"
}
```

**404 Not Found** — 任务 ID 不存在

```json
{
  "detail": "Task not found: a3f2c1d4-5e6f-7890-abcd-ef1234567890"
}
```

### 示例

```bash
curl http://localhost:8000/api/result/a3f2c1d4-5e6f-7890-abcd-ef1234567890
```

---

## 5. 错误码说明

| HTTP 状态码 | 含义 | 常见原因 |
|-------------|------|----------|
| `200` | 成功 | 请求正常处理完成 |
| `202` | 已接受 | 任务提交成功，异步处理中 |
| `400` | 请求错误 | 文件格式不支持、文件超过大小限制 |
| `404` | 资源不存在 | 查询的 task_id 不存在或已过期 |
| `422` | 请求验证失败 | 缺少必填字段（如未上传 manuscript 或 source）|
| `500` | 服务器内部错误 | 服务端异常，可查看服务日志定位原因 |
| `503` | 服务不可用 | Anthropic API 暂时不可用，建议稍后重试 |

**422 错误响应示例**（缺少 source 文件）

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "source"],
      "msg": "Field required",
      "input": null
    }
  ]
}
```

**400 错误响应示例**（不支持的文件格式）

```json
{
  "detail": "Unsupported file type '.epub'. Supported types: ['.docx', '.md', '.pdf', '.txt']"
}
```

---

## 6. 数据结构参考

### QuoteResult（单条引用校对结果）

```json
{
  "quote": "string",
  "has_issue": true | false | null,
  "text_accuracy": {
    "is_accurate": true | false | null,
    "issues": "string",
    "original_text": "string"
  },
  "interpretation_accuracy": {
    "is_accurate": true | false | null,
    "issues": "string",
    "suggestion": "string"
  },
  "context_appropriateness": {
    "is_appropriate": true | false | null,
    "issues": "string",
    "suggestion": "string"
  },
  "overall_suggestion": "string",
  "error": "string | null"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `quote` | string | 书稿中被校对的引用原文 |
| `has_issue` | boolean \| null | `true` 表示存在问题，`false` 表示无问题，`null` 表示校对失败 |
| `text_accuracy.is_accurate` | boolean \| null | 引用文字是否与原文一致 |
| `text_accuracy.issues` | string | 文字差异的具体说明，无差异时为空字符串 |
| `text_accuracy.original_text` | string | 原文中对应句子的正确写法 |
| `interpretation_accuracy.is_accurate` | boolean \| null | 作者对引用的解释是否与原文本义一致 |
| `interpretation_accuracy.issues` | string | 解释偏差的具体说明 |
| `interpretation_accuracy.suggestion` | string | 建议的修改方向 |
| `context_appropriateness.is_appropriate` | boolean \| null | 引用是否与书稿上下文相符，无断章取义问题 |
| `context_appropriateness.issues` | string | 上下文不符的具体说明 |
| `context_appropriateness.suggestion` | string | 建议的修改方向 |
| `overall_suggestion` | string | 针对本条引用的综合修改建议 |
| `error` | string \| null | 若校对过程发生错误，此字段包含错误信息；正常时为 `null` |

### ProofreadReport（完整校对报告）

```json
{
  "task_id": "string (UUID)",
  "quotes_total": 0,
  "issues_count": 0,
  "error_count": 0,
  "results": ["QuoteResult", "..."]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `task_id` | string | 本次任务的唯一标识符 |
| `quotes_total` | integer | 提取到的引用总数 |
| `issues_count` | integer | 存在问题的引用数量（`has_issue == true`） |
| `error_count` | integer | 校对失败的引用数量（`has_issue == null`） |
| `results` | array | `QuoteResult` 对象列表 |
