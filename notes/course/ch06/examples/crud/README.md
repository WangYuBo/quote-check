# CRUD 教学示例

本目录包含 Drizzle ORM 的 CRUD 操作教学示例，基于 Neon (PostgreSQL Serverless) 数据库。

## 文件说明

| 文件 | 内容 |
|------|------|
| `01-create.ts` | 插入操作：单条/批量插入、事务、upsert |
| `02-read.ts` | 查询操作：findFirst/findMany、关联查询、聚合、分页 |
| `03-update.ts` | 更新操作：单条/批量更新、乐观锁、SQL 表达式 |
| `04-delete.ts` | 删除操作：硬删除、软删除、级联删除 |

## 运行方式

### 执行所有步骤

```bash
bun run src/examples/crud/01-create.ts
bun run src/examples/crud/02-read.ts
bun run src/examples/crud/03-update.ts
bun run src/examples/crud/04-delete.ts
```

### 查看可用步骤

```bash
bun run src/examples/crud/01-create.ts help
bun run src/examples/crud/02-read.ts help
bun run src/examples/crud/03-update.ts help
bun run src/examples/crud/04-delete.ts help
```

### 执行特定步骤

```bash
# Create 示例
bun run src/examples/crud/01-create.ts 1.1   # 创建对话（基础插入）
bun run src/examples/crud/01-create.ts 1.2   # 创建消息（关联插入）
bun run src/examples/crud/01-create.ts 1.3   # 批量创建消息

# Read 示例
bun run src/examples/crud/02-read.ts 2.1    # 查询单个对话
bun run src/examples/crud/02-read.ts 2.3    # 关联查询：对话 + 消息
bun run src/examples/crud/02-read.ts 2.5    # 模糊搜索

# Update 示例
bun run src/examples/crud/03-update.ts 3.1  # 更新单个字段
bun run src/examples/crud/03-update.ts 3.3  # 归档对话（软删除）
bun run src/examples/crud/03-update.ts 3.8  # 乐观锁更新

# Delete 示例
bun run src/examples/crud/04-delete.ts 4.1  # 删除单条记录
bun run src/examples/crud/04-delete.ts 4.5  # 软删除
bun run src/examples/crud/04-delete.ts 4.10 # 删除模式总结
```

## 步骤清单

### 01-create.ts

| 步骤 | 说明 |
|------|------|
| 1.1 | 创建对话（基础插入） |
| 1.2 | 创建消息（关联插入） |
| 1.3 | 批量创建消息 |
| 1.4 | 事务：创建对话 + 首条消息 |
| 1.5 | 插入时处理冲突（upsert） |

### 02-read.ts

| 步骤 | 说明 |
|------|------|
| 2.1 | 查询单个对话 |
| 2.2 | 查询用户的对话列表 |
| 2.3 | 关联查询：对话 + 消息 |
| 2.4 | 查询对话的消息 |
| 2.5 | 模糊搜索 |
| 2.6 | 统计消息数量 |
| 2.7 | 统计 Token 消耗 |
| 2.8 | 时间范围查询 |
| 2.9 | 选择特定字段 |
| 2.10 | 检查记录是否存在 |

### 03-update.ts

| 步骤 | 说明 |
|------|------|
| 3.1 | 更新单个字段 |
| 3.2 | 更新多个字段 |
| 3.3 | 归档对话（软删除） |
| 3.4 | 批量更新 |
| 3.5 | 条件更新 |
| 3.7 | SQL 表达式更新 |
| 3.8 | 乐观锁更新 |
| 3.9 | 事务中更新（语法演示） |
| 3.10 | 安全更新 |

### 04-delete.ts

| 步骤 | 说明 |
|------|------|
| 4.1 | 删除单条记录 |
| 4.3 | 条件批量删除 |
| 4.5 | 软删除 |
| 4.6 | 查询活跃记录 |
| 4.8 | 安全删除 |
| 4.10 | 删除模式总结 |

## 核心实体

示例基于以下数据库表：

- `conversations` - 对话表
- `messages` - 消息表（与对话关联，级联删除）
- `groups` - 分组表（演示乐观锁）
- `apiKeys` - API 密钥表（演示软删除）

## 注意事项

1. **事务限制**：neon-http 驱动不支持事务，事务相关示例仅演示语法
2. **测试数据**：每次运行会自动创建测试数据，无需手动准备
3. **UUID 格式**：id 字段为 UUID 类型，测试不存在记录时使用 `00000000-0000-0000-0000-000000000000`
