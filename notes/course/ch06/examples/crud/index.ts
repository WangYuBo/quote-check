/**
 * CRUD 教学示例 - 汇总说明
 *
 * 本目录包含基于 Drizzle ORM + Neon 的 CRUD 操作完整示例
 * 核心实体：conversations（对话）+ messages（消息）
 *
 * ============================================================================
 * 文件结构
 * ============================================================================
 *
 * src/examples/crud/
 * ├── 01-create.ts    # Create（创建）操作
 * ├── 02-read.ts      # Read（查询）操作
 * ├── 03-update.ts    # Update（更新）操作
 * ├── 04-delete.ts    # Delete（删除）操作
 * └── index.ts        # 汇总说明（本文件）
 *
 * ============================================================================
 * 运行方式
 * ============================================================================
 *
 * 确保已配置 DATABASE_URL 环境变量，然后运行：
 *
 * ```bash
 * # 运行单个示例
 * bunx tsx src/examples/crud/01-create.ts
 * bunx tsx src/examples/crud/02-read.ts
 * bunx tsx src/examples/crud/03-update.ts
 * bunx tsx src/examples/crud/04-delete.ts
 *
 * # 或使用 package.json 脚本
 * bun run example:create
 * bun run example:read
 * bun run example:update
 * bun run example:delete
 * ```
 *
 * ============================================================================
 * ⭐ 核心示例（教学重点）
 * ============================================================================
 *
 * 以下是每个文件中最核心的 2-4 个示例，建议优先掌握：
 *
 * ## 01-create.ts - 核心 3 个
 * - ⭐ 1.1 创建对话（基础插入）    → insert + returning 基础
 * - ⭐ 1.2 创建消息（关联插入）    → 外键、jsonb、枚举
 * - ⭐ 1.4 事务创建对话+消息       → 真实业务场景
 *
 * ## 02-read.ts - 核心 4 个
 * - ⭐ 2.1 查询单个对话            → findFirst 基础
 * - ⭐ 2.2 查询对话列表            → findMany + 分页
 * - ⭐ 2.3 关联查询：对话+消息     → with 一对多
 * - ⭐ 2.6 统计消息数量            → count 聚合
 *
 * ## 03-update.ts - 核心 3 个
 * - ⭐ 3.1 更新单个字段            → update 基础
 * - ⭐ 3.2 更新多个字段            → 实际场景
 * - ⭐ 3.3 归档对话（软删除）      → isArchived 模式
 *
 * ## 04-delete.ts - 核心 3 个
 * - ⭐ 4.1 删除单条记录            → 硬删除基础
 * - ⭐ 4.2 级联删除                → 外键 cascade
 * - ⭐ 4.5 软删除                  → deletedAt 模式
 *
 * ============================================================================
 * 完整知识点索引
 * ============================================================================
 *
 * ## 01-create.ts - Create（创建）
 *
 * | 示例 | 知识点 | 核心 |
 * |------|--------|------|
 * | 1.1 | 单条插入、returning() | ⭐ |
 * | 1.2 | 外键关联、jsonb 字段、枚举字段 | ⭐ |
 * | 1.3 | 批量插入 | |
 * | 1.4 | 事务（transaction）保证原子性 | ⭐ |
 * | 1.5 | 冲突处理（onConflictDoNothing/DoUpdate） | |
 *
 * ## 02-read.ts - Read（查询）
 *
 * | 示例 | 知识点 | 核心 |
 * |------|--------|------|
 * | 2.1 | findFirst() 单条查询 | ⭐ |
 * | 2.2 | findMany() + 分页（limit/offset） | ⭐ |
 * | 2.3 | with 关联查询（一对多） | ⭐ |
 * | 2.4 | 消息分页查询 | |
 * | 2.5 | like() 模糊搜索 | |
 * | 2.6 | count() 统计 | ⭐ |
 * | 2.7 | sql`SUM()` 聚合 | |
 * | 2.8 | gte()/lte() 时间范围 | |
 * | 2.9 | select() 选择特定字段 | |
 * | 2.10 | 检查记录是否存在 | |
 *
 * ## 03-update.ts - Update（更新）
 *
 * | 示例 | 知识点 | 核心 |
 * |------|--------|------|
 * | 3.1 | 单字段更新 | ⭐ |
 * | 3.2 | 多字段更新、$onUpdate 自动时间戳 | ⭐ |
 * | 3.3 | 软删除（isArchived 标记） | ⭐ |
 * | 3.4 | 批量更新 | |
 * | 3.5 | and() 条件组合 | |
 * | 3.6 | 更新数值字段 | |
 * | 3.7 | sql`version + 1` 表达式 | |
 * | 3.8 | 乐观锁（version 检查） | |
 * | 3.9 | 事务中更新 | |
 * | 3.10 | 安全更新（检查返回值） | |
 *
 * ## 04-delete.ts - Delete（删除）
 *
 * | 示例 | 知识点 | 核心 |
 * |------|--------|------|
 * | 4.1 | 单条硬删除 | ⭐ |
 * | 4.2 | 级联删除（onDelete: cascade） | ⭐ |
 * | 4.3 | 条件批量删除 | |
 * | 4.4 | 删除过期数据（lt 比较） | |
 * | 4.5 | 软删除（设置 deletedAt） | ⭐ |
 * | 4.6 | isNull()/isNotNull() 查询 | |
 * | 4.7 | 事务中删除 | |
 * | 4.8 | 安全删除（权限检查） | |
 * | 4.9 | 清空表（危险操作） | |
 * | 4.10 | 删除模式总结 | |
 *
 * ============================================================================
 * 核心概念
 * ============================================================================
 *
 * ## 1. 查询构建器 vs Query API
 *
 * Drizzle 提供两种查询方式：
 *
 * ```typescript
 * // 方式 1：Query API（推荐，支持关联查询）
 * const result = await db.query.conversations.findFirst({
 *   where: eq(conversations.id, id),
 *   with: { messages: true },
 * });
 *
 * // 方式 2：查询构建器（更灵活，支持复杂 SQL）
 * const result = await db
 *   .select()
 *   .from(conversations)
 *   .where(eq(conversations.id, id));
 * ```
 *
 * ## 2. 条件操作符
 *
 * ```typescript
 * import { eq, ne, gt, gte, lt, lte, like, and, or, not, isNull, isNotNull } from 'drizzle-orm';
 *
 * eq(field, value)      // 等于
 * ne(field, value)      // 不等于
 * gt(field, value)      // 大于
 * gte(field, value)     // 大于等于
 * lt(field, value)      // 小于
 * lte(field, value)     // 小于等于
 * like(field, pattern)  // 模糊匹配
 * and(cond1, cond2)     // 与
 * or(cond1, cond2)      // 或
 * not(condition)        // 非
 * isNull(field)         // 为 null
 * isNotNull(field)      // 不为 null
 * ```
 *
 * ## 3. 事务
 *
 * ```typescript
 * const result = await db.transaction(async (tx) => {
 *   // 所有操作使用 tx 而非 db
 *   await tx.insert(table1).values({...});
 *   await tx.update(table2).set({...});
 *   // 自动提交或回滚
 *   return result;
 * });
 * ```
 *
 * ## 4. 删除模式对比
 *
 * | 模式 | 实现方式 | 可恢复 | 适用场景 |
 * |------|----------|--------|----------|
 * | 硬删除 | DELETE | ❌ | 临时数据 |
 * | 软删除 | SET deletedAt | ✅ | 重要数据 |
 * | 级联删除 | 外键 CASCADE | ❌ | 关联数据 |
 *
 * ============================================================================
 * 相关文件
 * ============================================================================
 *
 * - src/db/schema.ts   # 表定义
 * - src/db/index.ts    # 数据库连接
 * - drizzle.config.ts  # Drizzle 配置
 *
 */

// 导出所有示例函数，方便在其他地方调用
export * from './01-create';
export * from './02-read';
export * from './03-update';
export * from './04-delete';
