# AI原生项目模板

这是一个基于认知敏捷法(42COG)的AI原生项目初始化模板。

## 目录结构

```
projectname/
├── .42cog/              # 认知敏捷法核心文件
│   ├── meta/            # 项目元信息
│   ├── real/            # 现实约束
│   ├── cog/             # 认知模型
│   ├── spec/            # 规约文档
│   ├── work/            # 工作记录
│   └── others/          # 其他文档
├── .42plugin/           # 活水插件技能库 ⭐
│   └── 42edu/           # 教育版11个技能（技能安装位置）
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
├── notes/               # 项目笔记和文档
├── source/              # 原始素材和资源
└── src/                 # 源代码目录（代码生成位置）⭐
    ├── app/             # Next.js 应用目录
    ├── components/      # React 组件
    ├── lib/             # 工具库
    └── ...              # 其他代码文件
```

## 快速开始

1. **复制模板**
   ```bash
   cp -r project-template your-project-name
   cd your-project-name
   ```

2. **初始化项目元信息**
   编辑 `.42cog/meta/meta.md`，填写项目基本信息

3. **定义现实约束**（推荐简明写法）
   编辑 `.42cog/real/real.md`，列出项目的现实约束（最多7条）
   ```xml
   <real>
   - 用户密码必须使用bcrypt加密存储
   - 支付信息必须通过第三方支付网关处理
   - 订单金额计算必须在服务端完成
   </real>
   ```

4. **创建认知模型**（推荐简明写法）
   编辑 `.42cog/cog/cog.md`，定义项目的核心实体和关系
   ```xml
   <cog>
   本系统包括以下关键实体：
   - user：用户
   - product：商品
   - order：订单
   </cog>
   ```

5. **生成规约文档**
   使用 `.42plugin/42edu/` 下的技能生成各类规约文档
   > **技能位置**：所有技能安装在 `.42plugin/42edu/` 目录下

6. **开始编码**
   在 `src/` 目录下开发代码
   > **代码目录**：实际生成的代码文件放在 `src/` 目录下

## 认知敏捷法 (42COG)

### RCSW 工作流

```
Real (现实约束) → Cog (认知模型) → Spec (规约文档) → Work (实际作品)
```

### 11个核心技能

**用户角色 (2个)**
- user: 用户模拟使用
- admin: 管理员功能

**产品经理 (2个)**
- pr: 产品需求文档
- userstory: 用户故事

**开发 (5个)**
- sys: 系统架构设计
- db: 数据库设计
- code: 实际编码
- qa: 质量保证
- devops: 部署运维

**设计 (2个)**
- ui: 交互设计
- graphic: 平面设计

## 使用建议

1. **从现实出发**：先定义 `real.md`，明确项目的现实约束（推荐简明写法）
2. **建立认知模型**：在 `cog.md` 中定义核心实体和关系（推荐简明写法）
3. **按需生成规约**：根据项目阶段，使用 `.42plugin/42edu/` 下的技能生成规约文档
4. **代码开发**：在 `src/` 目录下开发实际代码
5. **持续迭代**：在 `work/` 目录记录工作日志，持续优化

## 技术栈建议

- **语言**: TypeScript (首选)
- **框架**: Next.js 15
- **UI**: Tailwind CSS + shadcn/ui
- **运行时**: Bun
- **数据库**: PostgreSQL / Neon / Supabase
- **ORM**: Drizzle ORM
- **认证**: Better Auth
- **AI**: Vercel AI SDK

## 更多资源

- 认知敏捷法文档: https://github.com/42ailab/42cog
- 活水插件平台: https://42plugin.com
- 活水AI实验室: https://42ailab.com
