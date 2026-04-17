# 源代码目录 (src)

这是项目的源代码目录，采用Next.js 15 App Router架构。

## 目录结构

```
src/
├── app/                    # App Router 路由
│   ├── (auth)/             # 认证路由组
│   │   ├── login/          # 登录页
│   │   │   └── page.tsx
│   │   └── register/       # 注册页
│   │       └── page.tsx
│   ├── (main)/             # 主应用路由组
│   │   ├── dashboard/      # 仪表盘
│   │   │   └── page.tsx
│   │   └── settings/       # 设置页
│   │       └── page.tsx
│   ├── api/                # API 路由
│   │   ├── auth/           # 认证API
│   │   │   └── route.ts
│   │   └── chat/           # 聊天API
│   │       └── route.ts
│   ├── layout.tsx          # 根布局
│   ├── page.tsx            # 首页
│   └── globals.css         # 全局样式
│
├── components/             # React 组件
│   ├── ui/                 # shadcn/ui 组件
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── chat/               # 业务组件
│   │   ├── ChatMessage.tsx
│   │   └── ChatInput.tsx
│   └── layout/             # 布局组件
│       ├── Header.tsx
│       └── Footer.tsx
│
├── lib/                    # 工具函数
│   ├── db/                 # 数据库配置
│   │   ├── client.ts       # 数据库客户端
│   │   └── schema.ts       # 数据库模式
│   ├── auth/               # 认证逻辑
│   │   ├── config.ts       # 认证配置
│   │   └── session.ts      # 会话管理
│   └── utils.ts            # 通用工具函数
│
├── services/               # 业务逻辑层
│   ├── user.service.ts     # 用户服务
│   ├── chat.service.ts     # 聊天服务
│   └── ai.service.ts       # AI服务
│
├── hooks/                  # React Hooks
│   ├── useAuth.ts          # 认证Hook
│   ├── useChat.ts          # 聊天Hook
│   └── useLocalStorage.ts  # 本地存储Hook
│
├── types/                  # TypeScript 类型
│   ├── user.ts             # 用户类型
│   ├── chat.ts             # 聊天类型
│   └── api.ts              # API类型
│
└── constants/              # 常量定义
    ├── routes.ts           # 路由常量
    ├── config.ts           # 配置常量
    └── messages.ts         # 消息常量
```

## 命名规范

### 文件命名
- **组件文件**：PascalCase（如 `ChatMessage.tsx`）
- **工具文件**：camelCase（如 `utils.ts`）
- **服务文件**：camelCase + `.service.ts`（如 `user.service.ts`）
- **类型文件**：camelCase（如 `user.ts`）
- **路由文件**：kebab-case（如 `user-profile/page.tsx`）

### 组件命名
- **React组件**：PascalCase（如 `export function ChatMessage()`）
- **Hook函数**：camelCase + use前缀（如 `export function useAuth()`）
- **工具函数**：camelCase（如 `export function formatDate()`）

## 代码组织原则

### 1. 按功能分组
- 相关的组件、服务、类型放在一起
- 使用目录结构体现功能模块

### 2. 单一职责
- 每个文件只负责一个功能
- 组件保持简单，复杂逻辑提取到Hook或Service

### 3. 可复用性
- 通用组件放在 `components/ui/`
- 业务组件放在 `components/[feature]/`
- 工具函数放在 `lib/utils.ts`

### 4. 类型安全
- 所有函数和组件都要有类型定义
- 使用TypeScript严格模式
- 避免使用 `any` 类型

## Next.js App Router 特性

### 路由组 (Route Groups)
使用 `(folder)` 创建路由组，不影响URL：
```
app/
├── (auth)/          # 认证相关页面
└── (main)/          # 主应用页面
```

### 服务端组件 (Server Components)
默认所有组件都是服务端组件：
```tsx
// app/page.tsx - 服务端组件
export default async function Page() {
  const data = await fetchData()
  return <div>{data}</div>
}
```

### 客户端组件 (Client Components)
需要交互时使用 `'use client'`：
```tsx
// components/Counter.tsx
'use client'
export function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

### API 路由
使用 `route.ts` 创建API端点：
```tsx
// app/api/users/route.ts
export async function GET() {
  return Response.json({ users: [] })
}
```

### Server Actions
直接在组件中定义服务端操作：
```tsx
async function createUser(formData: FormData) {
  'use server'
  // 服务端逻辑
}
```

## 样式方案

### Tailwind CSS
使用原子化CSS类：
```tsx
<div className="flex items-center gap-4 p-4 bg-white rounded-lg">
  <Button className="bg-blue-500 hover:bg-blue-600">
    Click me
  </Button>
</div>
```

### shadcn/ui
复制即用的组件库：
```bash
npx shadcn-ui@latest add button
```

### CSS Modules（可选）
组件专用样式：
```tsx
import styles from './Component.module.css'
```

## 状态管理

### 服务端状态
- 使用React Server Components
- 数据在服务端获取和渲染

### 客户端状态
- 简单状态：useState
- 复杂状态：useReducer
- 全局状态：React Context 或 Zustand

### 表单状态
- 使用 React Hook Form
- 配合 Zod 进行验证

## 数据获取

### 服务端获取
```tsx
// app/users/page.tsx
async function getUsers() {
  const res = await fetch('https://api.example.com/users')
  return res.json()
}

export default async function UsersPage() {
  const users = await getUsers()
  return <UserList users={users} />
}
```

### 客户端获取
```tsx
// components/UserList.tsx
'use client'
export function UserList() {
  const { data, isLoading } = useSWR('/api/users', fetcher)
  if (isLoading) return <Loading />
  return <div>{data.map(user => ...)}</div>
}
```

## 环境变量

### 配置文件
```bash
# .env.local
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_API_URL="https://api.example.com"
```

### 使用方式
```tsx
// 服务端
const dbUrl = process.env.DATABASE_URL

// 客户端（必须以NEXT_PUBLIC_开头）
const apiUrl = process.env.NEXT_PUBLIC_API_URL
```

## 性能优化

### 图片优化
使用Next.js Image组件：
```tsx
import Image from 'next/image'
<Image src="/photo.jpg" alt="Photo" width={500} height={300} />
```

### 代码分割
动态导入组件：
```tsx
import dynamic from 'next/dynamic'
const HeavyComponent = dynamic(() => import('./HeavyComponent'))
```

### 缓存策略
```tsx
// 静态生成
export const revalidate = 3600 // 1小时

// 动态路由
export const dynamic = 'force-dynamic'
```

## 测试

### 单元测试
使用 Vitest 或 Jest：
```tsx
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

test('renders button', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByText('Click me')).toBeInTheDocument()
})
```

### E2E测试
使用 Playwright：
```tsx
test('user can login', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="email"]', 'user@example.com')
  await page.fill('input[name="password"]', 'password')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/dashboard')
})
```

## 注意事项

1. **类型安全**：充分利用TypeScript的类型系统
2. **性能优化**：合理使用服务端组件和客户端组件
3. **代码复用**：提取通用逻辑到Hook和Service
4. **错误处理**：使用error.tsx和loading.tsx
5. **安全性**：敏感操作在服务端执行，验证用户输入
6. **可维护性**：保持代码简洁，添加必要的注释
7. **引用约束**：确保实现符合.42cog/real/real.md中的约束
