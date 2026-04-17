## 20251207

遇到的问题：生成`real.md`和`cog.md`时，AI 发现文档已存在，就自动备份，且未按模板样式生成文档。

解决方式：
- .42cog/real/real.md: 更名为`README.md`，将模板和示例拆分到 skill 下面，并在 skill 文档中引用。
- .42cog/cog/cog.md: 更名为`README.md`，将模板和示例拆分到 skill 下面，并在 skill 文档中引用。
- .42plugin/42edu/meta-42cog: 
    - 增加 template/ 和 example/ 目录，从`.42cog/real/real.md`和`.42cog/cog/cog.md`拆解出模板和示例。
    - `skill .md`添加模板和示例的引用。

统一`.42cog/`下四个目录的结构：
- .42cog/work/work.md: 更名为`README.md`，删除重复内容。

## 20251220

新增：
1. ch06 课程资料：notes/course/ch06
2. 三个技能：
  - .42plugin/42edu/dev-database-design-v2 
  - .42plugin/42edu/dev-coding 
  - .42plugin/42edu/dev-quality-assurance
3. notes：
  - notes/claude-code-advanced-techniques-public.md 
  - notes/claude-code-conversation-guide.md 

更新：notes/20251206-1.md

## 20251226

修改：
- 修正 neon-auth schema 及相关内容
  - .42plugin/42edu/dev-database-design/references
  - notes/course/ch06/examples/auth