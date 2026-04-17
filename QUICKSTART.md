# 快速开始指南

这是一个基于认知敏捷法(42COG)的AI原生项目模板快速开始指南。

## 第一步：复制模板

```bash
# 复制模板到你的项目目录
cp -r project-template your-project-name
cd your-project-name

# 初始化Git仓库
git init
git add .
git commit -m "Initial commit from 42COG template"
```

## 第二步：配置项目元信息

编辑 `.42cog/meta/meta.md`，填写项目基本信息：

```markdown
**项目名称**: 你的项目名称
**项目标语**: 一句话描述
**版本**: 0.1.0
**创建日期**: 2024-12-06
**负责人**: 你的名字
```

## 第三步：定义现实约束

编辑 `.42cog/real/real.md`，列出项目的现实约束（最多7条）。

**推荐使用简明写法**：

```xml
<real>
- 用户密码必须使用bcrypt加密存储
- 支付信息必须通过第三方支付网关处理，不得存储完整卡号
- 订单金额计算必须在服务端完成，不得信任客户端数据
- 库存扣减必须使用数据库事务保证原子性
</real>
```

**原则**：
- 必选约束最多4条，可选约束最多3条，总共不超过7条
- 侧重AI不太容易想到的事情，在现实世界中会造成破坏的事项
- 关注安全、合规、业务规则

## 第四步：创建认知模型

编辑 `.42cog/cog/cog.md`，定义项目的核心实体和关系。

**推荐使用简明写法**：

```xml
<cog>
本系统包括以下关键实体：
- user：用户
  - admin：管理员，一种特殊的user
- product：商品
- order：订单
</cog>

<user>
- 唯一编码：按照注册时间次序生成的UUID号
- 常见分类：游客；注册用户；VIP用户
</user>

<product>
- 唯一编码：商品SKU编码
- 常见分类：电子产品；服装；食品
</product>

<order>
- 唯一编码：订单号（日期+随机数）
- 常见分类：待支付；已支付；已发货；已完成；已取消
</order>

<rel>
- user-order：一对多（一个用户可创建多个订单）
- order-product：多对多（一个订单包含多个商品，一个商品可在多个订单中）
</rel>
```

## 第五步：使用技能生成规约

> **技能位置**：所有技能安装在 `.42plugin/42edu/` 目录下

使用这11个技能生成规约文档：

### 用户角色技能
```bash
# 1. 用户模拟使用
使用 .42plugin/42edu/user-simulation/

# 2. 管理员功能
使用 .42plugin/42edu/user-admin/
```

### 产品经理技能
```bash
# 3. 产品需求文档
使用 .42plugin/42edu/pm-product-requirements/

# 4. 用户故事
使用 .42plugin/42edu/pm-user-story/
```

### 开发技能
```bash
# 5. 系统架构设计
使用 .42plugin/42edu/dev-system-architecture/

# 6. 数据库设计
使用 .42plugin/42edu/dev-database-design/

# 7. 实际编码
使用 .42plugin/42edu/dev-coding/

# 8. 质量保证
使用 .42plugin/42edu/dev-quality-assurance/

# 9. 部署运维
使用 .42plugin/42edu/dev-deployment/
```

### 设计技能
```bash
# 10. 交互设计
使用 .42plugin/42edu/design-ui-design/

# 11. 平面设计
使用 .42plugin/42edu/design-graphic-design/
```

## 第六步：初始化代码项目

> **代码目录**：实际生成的代码文件放在 `src/` 目录下

在 `src/` 目录初始化Next.js项目：

```bash
cd src

# 使用Bun初始化Next.js项目
bun create next-app . --typescript --tailwind --app --use-bun

# 安装shadcn/ui
bunx shadcn-ui@latest init

# 安装常用依赖
bun add drizzle-orm @neondatabase/serverless
bun add better-auth
bun add ai @ai-sdk/anthropic

# 安装开发依赖
bun add -d drizzle-kit
```

## 第七步：配置环境变量

创建 `.env.local` 文件：

```bash
# 数据库
DATABASE_URL="postgresql://..."

# 认证
AUTH_SECRET="your-secret-key"

# AI
ANTHROPIC_API_KEY="sk-ant-..."

# 公开变量（客户端可访问）
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## 第八步：开始开发

```bash
# 启动开发服务器
bun dev

# 运行数据库迁移
bun run db:push

# 运行测试
bun test
```

## RCSW 工作流

遵循认知敏捷法的四阶段工作流：

```
Real (现实约束) → Cog (认知模型) → Spec (规约文档) → Work (实际作品)
```

### 1. Real - 定义现实约束
- 编辑 `.42cog/real/real.md`
- 列出必须遵守的硬性限制
- 最多7条约束

### 2. Cog - 建立认知模型
- 编辑 `.42cog/cog/cog.md`
- 定义核心实体和关系
- 使用XML语义闭合标签

### 3. Spec - 生成规约文档
- 使用 `.42plugin/42edu/` 下的技能
- 生成各类规约文档
- 规约文档保存在 `.42cog/spec/` 对应目录

### 4. Work - 实现作品
- 基于规约文档开发
- **代码生成在 `src/` 目录下**
- 记录工作日志在 `.42cog/work/work.md`
- 持续迭代优化

## 目录说明

```
your-project-name/
├── .42cog/              # 认知敏捷法核心文件
│   ├── meta/            # 项目元信息
│   ├── real/            # 现实约束
│   ├── cog/             # 认知模型
│   ├── spec/            # 规约文档（空文件，由技能生成）
│   ├── work/            # 工作记录
│   └── others/          # 其他文档
├── .42plugin/           # 活水插件技能库 ⭐
│   └── 42edu/           # 11个核心技能（技能安装位置）
│       ├── user-simulation/           # 用户模拟使用
│       ├── user-admin/                # 管理员功能
│       ├── pm-product-requirements/   # 产品需求文档
│       ├── pm-user-story/             # 用户故事
│       ├── dev-system-architecture/   # 系统架构设计
│       ├── dev-database-design/       # 数据库设计
│       ├── dev-coding/                # 实际编码
│       ├── dev-quality-assurance/     # 质量保证
│       ├── dev-deployment/            # 部署运维
│       ├── design-ui-design/          # 交互设计
│       └── design-graphic-design/     # 平面设计
├── notes/               # 项目笔记
├── source/              # 原始素材
├── src/                 # 源代码（代码生成目录）⭐
│   ├── app/             # Next.js 应用目录
│   ├── components/      # React 组件
│   ├── lib/             # 工具库
│   └── ...              # 其他代码文件
└── README.md            # 项目说明
```

## 常见问题

### Q: spec文件为什么是空的？
A: spec文件由 `.42plugin/42edu/` 下的技能生成，不需要手动编写。使用对应的技能工具生成规约文档。

### Q: 如何使用技能生成规约？
A: 每个技能目录下都有skill.md文件，按照说明使用AI工具（如Claude Code）调用技能生成规约。

### Q: 现实约束和认知模型有什么区别？
A:
- **现实约束(Real)**：必须遵守的硬性限制（安全、法律、业务规则）
- **认知模型(Cog)**：项目的核心实体和关系（数据模型、业务逻辑）

### Q: 为什么要用XML标签？
A: XML语义闭合标签让AI能够更准确地理解和处理文档结构，提高生成质量。

### Q: 可以不用所有11个技能吗？
A: 可以，根据项目需要选择使用。小项目可能只需要3-5个技能，大项目可能需要全部11个。

## 技术栈建议

- **语言**: TypeScript
- **框架**: Next.js 15
- **UI**: Tailwind CSS + shadcn/ui
- **运行时**: Bun
- **数据库**: PostgreSQL (Neon/Supabase)
- **ORM**: Drizzle ORM
- **认证**: Better Auth
- **AI**: Vercel AI SDK

## 下一步

1. 阅读 `README.md` 了解项目结构
2. 查看 `.42cog/` 目录下的示例文件
3. 浏览 `.42plugin/42edu/` 下的技能说明
4. 开始定义你的项目约束和模型
5. 使用技能生成规约文档
6. 开始编码实现

## 获取帮助

- 认知敏捷法文档: https://42cog.com
- 活水插件平台: https://42plugin.com
- 活水智能: https://huoshuiai.com
- 课程资料: https://github.com/your-repo

祝你开发顺利！🚀
