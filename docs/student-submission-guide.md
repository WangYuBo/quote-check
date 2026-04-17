# 学员作业提交指南

## 📋 概述

本指南将帮助你完成42aipr001课程的作业提交流程。

---

## 🎯 第一步：加入组织

### 1.1 扫描邀请二维码或点击邀请链接

- 讲师会提供一个邀请链接或二维码
- 使用你的CNB账号扫码或点击链接加入组织
- 你将获得**开发者**角色权限

### 1.2 确认加入成功

- 加入后，访问：https://cnb.cool/42edu/42aipr001
- 确认你能看到 `project-template-student` 仓库

---

## 🚀 第二步：克隆仓库到本地

打开终端，执行以下命令：

```bash
# 克隆仓库（请替换成实际的仓库地址）
git clone https://cnb.cool/42edu/42aipr001/project-template-student.git

# 进入项目目录
cd project-template-student
```

---

## 🌿 第三步：创建你的个人分支

**重要：每个学员必须在自己的分支上工作！**

```bash
# 创建并切换到你的个人分支（请替换"你的姓名"为你的真实姓名）
git checkout -b student-张三

# 示例：
# git checkout -b student-李四
# git checkout -b student-王五
```

**命名规范：**
- 格式：`student-你的姓名`
- 使用中文或拼音都可以
- 例如：`student-张三` 或 `student-zhangsan`

---

## 💻 第四步：完成作业

1. **在你的分支上完成作业代码**
2. **按照项目README.md的要求完成任务**
3. **确保代码能够正常运行**

---

## 📤 第五步：提交并推送代码

### 5.1 查看修改的文件

```bash
# 查看当前修改了哪些文件
git status
```

### 5.2 添加文件到暂存区

```bash
# 添加所有修改的文件
git add .

# 或者添加特定文件
git add 文件名
```

### 5.3 提交代码

```bash
# 提交代码（请写清楚你做了什么）
git commit -m "完成第一次作业：实现XXX功能"
```

### 5.4 推送到远程仓库

```bash
# 第一次推送你的分支
git push -u origin student-你的姓名

# 示例：
# git push -u origin student-张三

# 之后的推送只需要：
git push
```

---

## 🔀 第六步：创建合并请求（可选）

> **注意**：创建合并请求是**可选步骤**。如果讲师没有特别要求，你只需要将代码推送到你的个人分支即可，讲师会直接查看你的分支内容。

### 6.1 访问仓库页面

在浏览器中打开：
```
https://cnb.cool/42edu/42aipr001/project-template-student
```

### 6.2 创建合并请求

> ⚠️ **重要警告**：
> - **不要**将合并请求的目标分支设为 `main`
> - 如需创建合并请求，请联系讲师确认目标分支
> - 学生作业**不会**被合并到 main 分支

如果讲师要求创建合并请求：

1. 点击页面上的**"合并请求"**标签
2. 点击**"新建合并请求"**按钮
3. 配置合并请求：
   - **源分支**：选择你的分支（如 `student-张三`）
   - **目标分支**：**请向讲师确认**（通常不是 main）
4. 填写标题和描述：
   ```
   标题：[WIP][你的姓名] 第X次作业提交

   描述：
   - 完成了XXX功能
   - 实现了XXX需求
   - 遇到的问题和解决方案...
   ```
5. 点击**"创建合并请求"**

> 💡 **提示**：标题中的 `[WIP]` 表示 "Work In Progress"（进行中），可以防止意外合并。

### 6.3 等待审核

- 讲师会审核你的代码
- 可能会在PR中提出修改意见
- 根据反馈修改代码后，继续推送到你的分支即可（PR会自动更新）

---

## 🔄 第七步：根据反馈修改代码

如果讲师提出了修改意见：

```bash
# 1. 在本地修改代码

# 2. 再次提交
git add .
git commit -m "根据反馈修改：修复XXX问题"

# 3. 推送（PR会自动更新）
git push
```

---

## ✅ 第八步：合并完成

- 讲师批准后，你的代码会被合并到main分支
- 你可以继续在你的分支上进行下一次作业

---

## 🔧 常用命令速查表

```bash
# 查看当前分支
git branch

# 切换回自己的分支
git checkout student-你的姓名

# 从main分支获取最新更新
git checkout main
git pull
git checkout student-你的姓名
git merge main

# 查看提交历史
git log --oneline

# 撤销未提交的修改
git checkout -- 文件名

# 查看远程仓库地址
git remote -v
```

---

## ❓ 常见问题

### Q1: 我不小心在main分支上修改了代码怎么办？

```bash
# 1. 查看当前分支
git branch

# 2. 如果在main分支，先保存你的修改
git stash

# 3. 切换到你的分支
git checkout student-你的姓名

# 4. 恢复你的修改
git stash pop
```

### Q2: 推送时提示"没有权限推送到main分支"

这是正常的！main分支已被保护，你需要：
1. 确认你在自己的分支上：`git branch`
2. 如果不是，切换到你的分支：`git checkout student-你的姓名`
3. 再次推送：`git push`

### Q3: 如何同步main分支的最新代码？

```bash
# 1. 切换到main分支
git checkout main

# 2. 拉取最新代码
git pull

# 3. 切换回你的分支
git checkout student-你的姓名

# 4. 合并main的更新到你的分支
git merge main
```

### Q4: 提交代码前需要测试吗？

是的！请确保：
- ✅ 代码能够正常运行
- ✅ 没有语法错误
- ✅ 完成了作业要求的所有功能
- ✅ 提交前再次检查一遍

### Q5: Pull Request创建后可以继续修改吗？

可以！在PR审核期间：
1. 在本地继续修改代码
2. 提交并推送：`git push`
3. PR会自动更新你的最新修改

---

## 📞 获取帮助

如果遇到问题：
1. **查看本指南的常见问题部分**
2. **在课程群里提问**
3. **联系讲师或助教**
4. **查看Git官方文档**：https://git-scm.com/doc

---

## ⚠️ 重要提醒

### ✅ 务必做到：
- 在自己的分支上工作
- 提交前测试代码
- 写清楚commit message
- 按时提交作业

### ❌ 千万不要：
- 直接在main分支上提交代码
- 创建目标分支为 main 的合并请求
- 删除或修改其他同学的分支
- 提交包含敏感信息的代码（密码、密钥等）
- 复制粘贴其他同学的代码

---

## 🎓 学习资源

- **Git基础教程**：https://www.runoob.com/git/git-tutorial.html
- **Git可视化学习**：https://learngitbranching.js.org/?locale=zh_CN
- **CNB平台文档**：https://cnb.cool/docs

---

**祝学习顺利！💪**

如有任何问题，随时联系讲师团队。
