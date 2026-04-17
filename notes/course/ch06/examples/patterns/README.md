# 架构模式选型指南

本目录展示 Next.js 中实现数据操作的四种常见架构模式。

## 快速选型决策树

```
你的项目是什么类型？
│
├─ 纯网页应用（无移动端/第三方调用）
│  └─ ✅ 推荐：Server Actions（01-server-actions.ts）
│
├─ 需要给移动端 / 第三方系统调用
│  └─ ✅ 推荐：API Routes（02-api-routes.ts）
│
├─ 中型项目 / 查询逻辑复用多
│  └─ ✅ 推荐：Repository 模式（03-repository.ts）
│
└─ 企业级 / 复杂业务逻辑
   └─ ✅ 推荐：Service + Repository（04-service-layer.ts）
```

## 四种模式对比

| 特性 | Server Actions | API Routes | Repository | Service 层 |
|------|---------------|------------|------------|-----------|
| **复杂度** | 低 | 中 | 中 | 高 |
| **适用规模** | 小型 | 中型 | 中型 | 大型 |
| **客户端调用** | 仅网页 | 任意客户端 | - | - |
| **代码复用** | 低 | 低 | 高 | 高 |
| **测试难度** | 中 | 低 | 低 | 低 |
| **学习曲线** | 低 | 低 | 中 | 高 |

## 模式详解

### 1. Server Actions（纯网页应用）

**文件位置**：`app/actions/*.ts` 或组件内 `'use server'`

**特点**：
- Next.js 14+ 推荐方式
- 无需手动创建 API 端点
- 自动处理序列化/反序列化
- 支持渐进式增强（Progressive Enhancement）

**适用场景**：
- 纯网页应用
- 表单提交
- 数据变更操作

```typescript
// app/actions/conversation.ts
'use server'

export async function createConversation(data: CreateInput) {
  // 直接操作数据库
  return await db.insert(conversations).values(data).returning();
}
```

### 2. API Routes（给第三方用）

**文件位置**：`app/api/*/route.ts`

**特点**：
- 标准 RESTful API
- 支持所有 HTTP 方法
- 任意客户端可调用
- 需要手动处理 JSON 序列化

**适用场景**：
- 移动端 App 调用
- 第三方系统集成
- Webhook 接收
- 公开 API

```typescript
// app/api/conversations/route.ts
export async function POST(request: Request) {
  const data = await request.json();
  const result = await db.insert(conversations).values(data).returning();
  return Response.json(result[0]);
}
```

### 3. Repository 模式（查询复用）

**文件位置**：`repositories/*.repository.ts`

**特点**：
- 封装数据访问逻辑
- 可被 Server Actions 和 API Routes 复用
- 单一职责：只负责数据存取
- 便于单元测试

**适用场景**：
- 相同查询在多处使用
- 需要统一的数据访问入口
- 方便 Mock 测试

```typescript
// repositories/conversation.repository.ts
export class ConversationRepository {
  async findById(id: string) {
    return db.query.conversations.findFirst({
      where: eq(conversations.id, id)
    });
  }
}
```

### 4. Service + Repository（企业级）

**文件位置**：
- `services/*.service.ts`（业务逻辑）
- `repositories/*.repository.ts`（数据访问）

**特点**：
- 三层架构：Controller → Service → Repository
- 关注点分离
- Service 处理业务逻辑
- Repository 处理数据存取
- 便于团队协作

**适用场景**：
- 大型企业级项目
- 复杂业务逻辑
- 多人团队协作
- 需要事务管理

```typescript
// services/conversation.service.ts
export class ConversationService {
  constructor(private repo: ConversationRepository) {}

  async createWithFirstMessage(data: CreateInput) {
    // 业务逻辑：创建对话 + 首条消息
    return db.transaction(async (tx) => {
      const conv = await this.repo.create(data, tx);
      await this.messageRepo.create({ conversationId: conv.id, ... }, tx);
      return conv;
    });
  }
}
```

## 文件列表

| 文件 | 说明 | 运行方式 |
|------|------|---------|
| `01-server-actions.ts` | Server Actions 示例 | `bunx tsx src/examples/patterns/01-server-actions.ts` |
| `02-api-routes.ts` | API Routes 示例 | `bunx tsx src/examples/patterns/02-api-routes.ts` |
| `03-repository.ts` | Repository 模式示例 | `bunx tsx src/examples/patterns/03-repository.ts` |
| `04-service-layer.ts` | Service 层示例 | `bunx tsx src/examples/patterns/04-service-layer.ts` |

## 渐进式演进路径

```
小型项目                    中型项目                    大型项目
   │                           │                          │
   ▼                           ▼                          ▼
Server Actions  ───────►  + Repository  ───────►  + Service 层
   │                           │                          │
   └───────────────────────────┴──────────────────────────┘
                        需要 API？加上 API Routes
```

**建议**：
1. 新项目从 Server Actions 开始
2. 发现查询重复时，抽取 Repository
3. 业务逻辑复杂时，加入 Service 层
4. 需要给外部调用时，添加 API Routes
