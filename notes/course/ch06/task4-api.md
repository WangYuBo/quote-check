task: 使用 bun 查询 API 接口

1. 生成 API Route 代码
2. 使用 bun 查询对话列表

---

## 操作步骤

### 步骤 1：生成 API Routes

在 `src/app/api/v1/conversations/` 目录下创建 RESTful API：
- `route.ts`：GET（列表+分页+搜索）、POST（创建）
- `[id]/route.ts`：GET（详情）、PUT（更新）、DELETE（软删除）

### 步骤 2：启动开发服务器

```bash
bun run dev
```

### 步骤 3：使用 bun 测试 API

```bash
# 查询对话列表
bun -e "fetch('http://localhost:3000/api/v1/conversations').then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2)))"

# 分页查询（第1页，5条）
bun -e "fetch('http://localhost:3000/api/v1/conversations?page=1&limit=5').then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2)))"

# 关键词搜索
bun -e "fetch('http://localhost:3000/api/v1/conversations?q=测试').then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2)))"

# 查看分页统计
bun -e "fetch('http://localhost:3000/api/v1/conversations').then(r=>r.json()).then(d=>console.log(d.pagination))"
```

---

## API 路由结构

```
src/app/api/v1/conversations/
├── route.ts       # GET 列表 / POST 创建
└── [id]/
    └── route.ts   # GET 详情 / PUT 更新 / DELETE 删除
```

## RESTful 约定

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/v1/conversations` | 获取列表 |
| POST | `/api/v1/conversations` | 创建 |
| GET | `/api/v1/conversations/:id` | 获取详情 |
| PUT | `/api/v1/conversations/:id` | 更新 |
| DELETE | `/api/v1/conversations/:id` | 删除 |

## 参考

- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
