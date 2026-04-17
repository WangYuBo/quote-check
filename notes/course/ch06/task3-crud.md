task: 使用 Drizzle ORM 对数据库进行 CRUD 操作

## 运行示例

```bash
# 查看可用步骤
bun run course/ch06/examples/crud/01-create.ts help

# 执行特定步骤
bun run course/ch06/examples/crud/01-create.ts 1.1   # 创建对话
bun run course/ch06/examples/crud/02-read.ts 2.5    # 模糊搜索
bun run course/ch06/examples/crud/03-update.ts 3.1  # 更新字段
bun run course/ch06/examples/crud/04-delete.ts 4.5  # 软删除

# 执行某类操作的所有步骤
bun run course/ch06/examples/crud/01-create.ts
```

## 示例代码

完整代码见：[course/ch06/examples/crud/](./examples/crud/)

| 文件 | 内容 |
|------|------|
| `01-create.ts` | 插入：单条/批量、事务、upsert |
| `02-read.ts` | 查询：findFirst、关联查询、聚合、分页 |
| `03-update.ts` | 更新：单条/批量、乐观锁、SQL 表达式 |
| `04-delete.ts` | 删除：硬删除、软删除、级联删除 |

## 最佳实践

1. **使用 returning()** - 获取操作后的完整数据
2. **优先软删除** - 使用 `isDeleted` 标记而非物理删除
3. **错误处理** - 使用 try-catch 包装数据库操作

## 参考文档

- [Drizzle ORM CRUD](https://orm.drizzle.team/docs/crud)
- [Drizzle ORM 查询 API](https://orm.drizzle.team/docs/rqb)