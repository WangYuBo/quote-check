> ⚠️ **本文件为 Python MVP（`origin/`）时期的历史归档，已不再代表当前架构**
>
> v1.0 起项目技术栈已转向 **TypeScript + Next.js 15 + Vercel + Inngest + Neon + Drizzle**，docker / FastAPI / Python 路线不再演进。权威架构见 [`.42cog/spec/spec-system-architecture.md`](../.42cog/spec/spec-system-architecture.md)。本文档保留仅为历史参考，请勿据此起开发任务。

---

# 图书引用校对工具 — 系统架构说明（MVP 历史归档）

## 1. 项目概述

本工具接收两份文档输入：
- **书稿 A**：待校对的书稿（引用方）
- **参考原文 B**：被引用的原始资料（被引用方）

系统从书稿 A 中自动提取所有引用片段，与原文 B 进行逐条比对，借助 Claude API 判断引用的准确性，最终输出结构化校对报告。

---

## 2. 目录结构

```
proofreader/
├── app/
│   ├── __init__.py
│   ├── config.py               # 全局配置（Pydantic BaseSettings）
│   ├── main.py                 # FastAPI 应用入口，注册路由与中间件
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py           # HTTP 路由定义（上传、校对、报告）
│   ├── services/
│   │   ├── __init__.py
│   │   ├── file_parser.py      # 文档解析：docx / pdf / md / txt
│   │   ├── quote_extractor.py  # 从书稿 A 提取引用片段
│   │   ├── proofreader.py      # 调用 Claude API 进行引用比对
│   │   └── report_builder.py   # 组装最终校对报告
│   └── prompts/
│       ├── __init__.py
│       └── proofread.py        # Claude 提示词模板
├── templates/
│   └── index.html              # Jinja2 页面模板
├── static/
│   ├── style.css
│   └── index.js
├── uploads/                    # 运行时上传文件存储（git 忽略）
├── docs/
│   └── architecture.md         # 本文件
├── requirements.txt
├── .env.example
└── .gitignore
```

---

## 3. 各模块职责

| 模块 | 职责 |
|------|------|
| `app/config.py` | 读取环境变量、定义上传限制与支持格式 |
| `app/main.py` | 创建 FastAPI 实例，挂载静态文件、模板，注册路由 |
| `app/api/routes.py` | 定义 HTTP 端点，处理请求/响应的序列化与错误 |
| `app/services/file_parser.py` | 统一接口解析 docx/pdf/md/txt，返回纯文本 |
| `app/services/quote_extractor.py` | 通过正则或 AI 从书稿中识别引用段落 |
| `app/services/proofreader.py` | 将引用与原文拼装 Prompt，调用 Claude，解析返回 |
| `app/services/report_builder.py` | 将比对结果组装为结构化报告（JSON / HTML） |
| `app/prompts/proofread.py` | 维护 Claude 提示词模板，支持参数替换 |

---

## 4. 数据流

```
用户浏览器
    │
    │  POST /api/proofread
    │  (书稿A + 原文B，multipart/form-data)
    ▼
┌─────────────────────────────────────────────┐
│  FastAPI  app/api/routes.py                 │
│  1. 校验文件大小与格式                       │
│  2. 保存文件到 uploads/                     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  file_parser.py                             │
│  解析书稿A → text_a                         │
│  解析原文B → text_b                         │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  quote_extractor.py                         │
│  从 text_a 提取引用列表                      │
│  quotes = [ {text, context, page?}, ... ]   │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  proofreader.py  (Claude API)               │
│  对每条引用构建 Prompt：                     │
│    - 引用原文                               │
│    - 引用上下文                             │
│    - 原文 B 相关段落                         │
│  Claude 返回：                              │
│    - is_accurate: bool                      │
│    - issues: [字句差异, 语义偏差, 断章取义]  │
│    - suggestion: str                        │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  report_builder.py                          │
│  组装 ProofreadReport：                     │
│    {summary, total, passed, failed,         │
│     items: [ProofreadItem, ...]}            │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
用户浏览器  ←  JSON 响应 / HTML 报告页面
```

---

## 5. API 端点列表

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/` | 主页（上传表单） |
| `POST` | `/api/proofread` | 上传两份文档，触发校对流程，返回报告 JSON |
| `GET` | `/api/report/{task_id}` | 查询已完成任务的校对报告（预留） |
| `DELETE` | `/api/upload/{filename}` | 删除已上传文件（预留） |

### POST /api/proofread 请求体

```
Content-Type: multipart/form-data

manuscript  : File   # 书稿A（docx/pdf/md/txt）
reference   : File   # 参考原文B（docx/pdf/md/txt）
```

### POST /api/proofread 响应体（200 OK）

```json
{
  "task_id": "uuid",
  "summary": "共检测到 12 处引用，10 处准确，2 处存在问题",
  "total": 12,
  "passed": 10,
  "failed": 2,
  "items": [
    {
      "index": 1,
      "quote_text": "...",
      "context": "...",
      "is_accurate": false,
      "issues": ["字句有差异：原文为「...」，书稿写作「...」"],
      "suggestion": "建议修改为..."
    }
  ]
}
```

---

## 6. 技术选型说明

| 技术 | 用途 | 版本要求 |
|------|------|----------|
| FastAPI | Web 框架，异步支持 | >= 0.111 |
| Uvicorn | ASGI 服务器 | >= 0.29 |
| Jinja2 | 服务端模板渲染 | >= 3.1 |
| python-docx | 解析 .docx 文件 | >= 1.1 |
| pdfplumber | 解析 .pdf 文件（含表格） | >= 0.11 |
| markdown | 解析 .md 文件 | >= 3.6 |
| anthropic | Claude API 客户端 | >= 0.28 |
| pydantic-settings | 环境变量配置管理 | >= 2.3 |
| aiofiles | 异步文件 I/O | >= 23.2 |

---

## 7. 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `ANTHROPIC_API_KEY` | 是 | Anthropic API 密钥 |
| `CLAUDE_MODEL` | 否 | 默认 `claude-sonnet-4-6` |
| `MAX_UPLOAD_SIZE_MB` | 否 | 默认 `50`（MB） |
| `DEBUG` | 否 | 默认 `false` |
