task: 使用 drizzle 的 push、generate、migrate 命令

1. 安装 drizzle 依赖
2. 编写 schema.ts 文件
3. 使用 push 命令
4. 使用 generate + migrate 命令
5. （可选）打开 drizzle-studio

---

## 操作指引

### 步骤 1：安装 Drizzle 依赖

```bash
# 安装 drizzle-orm 和 drizzle-kit
bun add drizzle-orm
bun add -D drizzle-kit

# 安装 Neon serverless 驱动
bun add @neondatabase/serverless
```

### 步骤 2：创建 Drizzle 配置文件

在项目根目录创建 `drizzle.config.ts`：

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**注意**：使用 `bun` 命令（而非 `bunx`）运行 drizzle-kit，`bun` 会自动加载 `.env` 文件。

### 步骤 3：编写 schema.ts 文件

创建 `src/db/schema.ts`，定义数据表结构：

```typescript
import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

// 示例：对话表
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isDeleted: boolean("is_deleted").default(false).notNull(),
});

// 示例：消息表
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: serial("conversation_id").references(() => conversations.id),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### 步骤 4：使用 push 命令（开发环境推荐）

`push` 命令直接将 schema 变更应用到数据库，适合**本地开发**：

```bash
bun drizzle-kit push
```

**特点**：
- 快速迭代，无需生成迁移文件
- 适合开发阶段频繁修改 schema
- 不生成 SQL 文件，直接同步到数据库

### 步骤 5：使用 generate + migrate 命令（生产环境推荐）

#### 5.1 生成迁移文件

```bash
bun drizzle-kit generate
```

执行后会在 `drizzle/` 目录生成 SQL 迁移文件，如：

```sql
-- drizzle/0000_create_conversations.sql
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "is_deleted" boolean DEFAULT false NOT NULL
);
```

#### 5.2 应用迁移

```bash
bun drizzle-kit migrate
```

**特点**：
- 生成版本化的 SQL 文件
- 迁移历史可追溯
- 适合生产环境和团队协作

### 步骤 6：（可选）打开 Drizzle Studio

Drizzle Studio 是一个可视化数据库管理工具：

```bash
bun drizzle-kit studio
```

默认在 `https://local.drizzle.studio` 打开。

自定义端口：

```bash
bun drizzle-kit studio --port=4000
```

### 命令对比

| 命令 | 用途 | 适用场景 |
|------|------|----------|
| `push` | 直接同步 schema 到数据库 | 本地开发、快速迭代 |
| `generate` | 生成 SQL 迁移文件 | 生产环境、团队协作 |
| `migrate` | 执行迁移文件 | 应用生成的迁移 |
| `studio` | 可视化数据库管理 | 查看和编辑数据 |

### 常见问题：重复执行会冲突吗？

**Q: 连续执行 `generate` + `migrate` 会产生冲突吗？**

A: 不会。Drizzle 会自动处理：
- `generate` 只在 schema 有变化时生成新的增量迁移
- `migrate` 只执行未执行过的迁移（通过 `__drizzle_migrations` 表追踪）

**Q: `push` 和 `generate + migrate` 可以混用吗？**

A: 不建议。这两种方式应该**二选一**：

```bash
# ❌ 错误用法：混用会导致冲突
bun drizzle-kit push      # 直接创建了表
bun drizzle-kit generate  # 生成 CREATE TABLE 迁移
bun drizzle-kit migrate   # 报错：表已存在

# ✅ 正确用法 1：开发环境用 push
bun drizzle-kit push

# ✅ 正确用法 2：生产环境用 generate + migrate
bun drizzle-kit generate
bun drizzle-kit migrate
```

**建议**：
- 开发阶段：统一用 `push`（快速迭代）
- 准备上线：从头用 `generate + migrate`（生成完整迁移历史）

### 创建数据库连接文件

创建 `src/db/index.ts`：

```typescript
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

### 常用 package.json scripts

```json
{
  "scripts": {
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

### 参考文档

- [Drizzle ORM 官方文档](https://orm.drizzle.team)
- [Drizzle with Neon 教程](https://orm.drizzle.team/docs/tutorials/drizzle-with-neon)
- [Drizzle Kit 命令参考](https://orm.drizzle.team/docs/drizzle-kit-overview)