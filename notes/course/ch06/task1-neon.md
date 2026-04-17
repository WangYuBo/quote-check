task: 登录 neon 创建数据库并配置数据库连接

1. 注册/登录 [neon官方](https://neon.com)
2. 创建 PostgreSQL 数据库，建议：版本 17、新加坡区域
3. 配置数据库连接，切换到开发分支
  - 可使用 claude code 的 [neon 官方插件](https://neon.com/docs/ai/ai-claude-code-plugin)

---

## 操作指引

### 步骤 1：注册/登录 Neon

1. 访问 [neon.com](https://neon.com)
2. 点击 "Sign Up" 或 "Log In"
3. 可使用 GitHub、Google 账号快捷登录

### 步骤 2：创建 PostgreSQL 数据库

1. 登录后进入 Neon Console
2. 点击 "New Project" 创建新项目
3. 填写项目信息：
   - **Project name**: 输入项目名称（如 `42chatdemo`）
   - **PostgreSQL version**: 选择 `17`（推荐最新版）
   - **Region**: 选择 `Singapore`（亚太区域延迟更低）
4. 点击 "Create Project" 完成创建

### 步骤 3：获取数据库连接字符串

1. 项目创建完成后，进入项目详情页
2. 在 "Connection Details" 区域找到连接字符串
3. 切换 Connection Type 为 `pooled`（推荐用于 Serverless）
4. 复制连接字符串，格式如下：
   ```
   postgresql://username:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

### 步骤 4：配置环境变量

在项目根目录创建或编辑 `.env` 文件：

```bash
# Neon 数据库连接（pooled 模式）
DATABASE_URL="postgresql://username:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

### 步骤 5：安装 Neon Serverless 驱动

```bash
bun add @neondatabase/serverless
```

### 步骤 6：（可选）创建开发分支

Neon 支持数据库分支，类似 Git 分支：

1. 在 Neon Console 中，点击 "Branches"
2. 点击 "Create Branch"
3. 选择从 `main` 分支创建
4. 命名为 `dev/your-name`
5. 创建后获取新分支的连接字符串

### 步骤 7：（可选）使用 Claude Code Neon 插件

Claude Code 提供了官方 Neon 插件，可直接在终端操作：

```bash
# 列出所有项目
# Claude Code 会自动调用 Neon MCP 工具

# 直接在对话中使用：
# "列出我的 Neon 项目"
# "在 42chatdemo 项目中执行 SQL: SELECT * FROM users"
```

参考文档：[Neon Claude Code Plugin](https://neon.com/docs/ai/ai-claude-code-plugin)

### 验证连接

创建 `src/db/index.ts` 测试连接：

```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// 测试连接
async function testConnection() {
  const result = await sql`SELECT version()`;
  console.log('PostgreSQL version:', result[0].version);
}

testConnection();
```

运行测试：

```bash
bun run src/db/index.ts
```
