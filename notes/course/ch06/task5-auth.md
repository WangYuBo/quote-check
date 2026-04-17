task: 实现登录功能。要求：

- 只需要 email + 密码登录（不需要 OAuth）
- 不需要邮箱验证（注册后直接登录）
- 不需要密码重置功能
- 需要完整的登录/注册页面 UI

---

> 以下操作指引仅供了解，不要求掌握技术细节

## 操作指引

> 参考文档：
> - [Neon Auth 官方文档](https://neon.com/docs/auth)
> - [Neon Auth 迁移指南](https://neon.com/docs/auth/migrate/from-legacy-auth)
> - [Better Auth 官方文档](https://www.better-auth.com/docs/installation)

### Neon Auth 原生方案优势

| 特性 | 说明 |
|------|------|
| **原生分支支持** | 认证数据随数据库分支自动复制 |
| **数据库为真实来源** | 无需 webhook 同步，直接 SQL 查询用户 |
| **简化配置** | 只需 1 个环境变量 |
| **与 usersSync 无缝集成** | 项目 schema.ts 已使用 `usersSync` |

---

### 步骤 1: 在 Neon Console 启用 Auth

1. 进入 Neon Console → 选择项目
2. 点击 **Auth** 标签页
3. 启用 Neon Auth
4. 复制 **Auth URL**

### 步骤 2: 安装依赖

```bash
bun add @neondatabase/neon-auth-next @neondatabase/neon-auth-ui
```

### 步骤 3: 配置环境变量

`.env.local`:
```env
NEXT_PUBLIC_NEON_AUTH_URL=https://ep-xxx.neonauth.us-east-2.aws.neon.build/neondb/auth
```

> 在 Neon Console → Auth → Configuration 获取

### 步骤 4: 创建 Auth Client

`src/lib/auth-client.ts`:
```typescript
import { createAuthClient } from '@neondatabase/neon-auth-next';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_NEON_AUTH_URL,
});
```

### 步骤 5: 创建 API 路由

`src/app/api/auth/[...all]/route.ts`:
```typescript
import { authClient } from '@/lib/auth-client';
import { toNextJsHandler } from '@neondatabase/neon-auth-next';

export const { GET, POST } = toNextJsHandler(authClient);
```

### 步骤 6: 配置 Provider

`src/app/layout.tsx` 中添加:
```typescript
import { NeonAuthUIProvider } from '@neondatabase/neon-auth-ui';
import '@neondatabase/neon-auth-ui/styles.css';
import { authClient } from '@/lib/auth-client';

// 在 children 外层包裹
<NeonAuthUIProvider authClient={authClient}>
  {children}
</NeonAuthUIProvider>
```

### 步骤 7: 创建登录/注册页面

`src/app/auth/sign-in/page.tsx`:
```typescript
import { AuthView } from '@neondatabase/neon-auth-ui';

export default function SignInPage() {
  return <AuthView pathname="sign-in" />;
}
```

`src/app/auth/sign-up/page.tsx`:
```typescript
import { AuthView } from '@neondatabase/neon-auth-ui';

export default function SignUpPage() {
  return <AuthView pathname="sign-up" />;
}
```

### 步骤 8: 获取 Session

```typescript
// 客户端 Hook
const { data: session } = authClient.useSession();

// 服务端
const session = await authClient.getSession();
```

---

### 目录结构

```
src/
├── lib/
│   └── auth-client.ts       # Neon Auth 客户端
├── app/
│   ├── layout.tsx           # 添加 NeonAuthUIProvider
│   ├── api/auth/[...all]/route.ts  # Auth API 路由
│   └── auth/
│       ├── sign-in/page.tsx  # 登录页
│       └── sign-up/page.tsx  # 注册页
└── db/
    └── schema.ts            # 已有，使用 usersSync
```

### 与现有 Schema 的关系

项目 `src/db/schema.ts` 已正确配置：
- 使用 `usersSync` 从 `drizzle-orm/neon` 导入
- 业务表通过 `references(() => usersSync.id)` 关联用户

**无需手动生成 auth schema**，Neon 自动管理 `neon_auth` schema。

### 注意事项

1. **使用 Neon Auth 原生方案**：基于 Better Auth，但使用 Neon 官方 SDK
2. **Schema 自动管理**：`neon_auth` schema 由 Neon 托管，无需 CLI 生成
3. **分支自动继承**：创建数据库分支时，认证配置自动复制

