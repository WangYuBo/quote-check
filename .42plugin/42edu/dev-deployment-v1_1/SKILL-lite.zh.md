---
name: dev-deployment
description: 将 Next.js 项目部署到 EdgeOne Pages（SSG/SSR 自动检测、本地 CLI 或 CNB 流水线）
version: "1.0-lite"
---

# Next.js → EdgeOne Pages 部署

## 前置条件

1. Next.js 项目已构建完成
2. 有 EdgeOne 账号与 token（本地模式）或 CNB 仓库（流水线模式）

## 流程

### 1. 检测项目类型

| 类型 | 判据 | 产物目录 |
|------|------|----------|
| SSG | `next.config.*` 含 `output: 'export'` | `out/` |
| SSR | 无 export 配置 | `.next/` |

### 2. 提取部署参数

从对话中自动识别，缺失才询问：

| 参数 | 说明 | 默认 |
|------|------|------|
| `name` | 项目名（部署唯一标识）| 目录名 |
| `area` | 区域 | `global` / `overseas` |
| `method` | 方式 | `local` / `cnb` |

### 3. 部署方式

#### 方式 A：本地 CLI 推送

```bash
# 安装 CLI
npm i -g edgeone
# 登录（首次）
edgeone login
# 部署
edgeone pages deploy [out|.next] -n <name> -a <area>
```

#### 方式 B：CNB 流水线推送

生成 `.cnb.yml`：
```yaml
main:
  push:
    - stages:
      - name: deploy
        image: node:20
        script:
          - npm ci && npm run build
          - npx edgeone pages deploy ./out -n <name> -a <area> -t $EDGEONE_TOKEN
```

配置 CNB 环境变量：`EDGEONE_TOKEN`

### 4. SSR 环境变量配置

SSR 首次部署后，需在 EdgeOne 控制台 → 项目 → 环境变量 手动添加，然后触发重新部署。

## SSG vs SSR 差异

| 维度 | SSG | SSR |
|------|-----|-----|
| 构建产物 | `out/` 静态文件 | `.next/` 服务端 |
| 部署目标 | 静态 CDN | 边缘函数 |
| 环境变量 | 构建时注入 | 运行时注入 |
| 适用场景 | 内容站、文档 | 动态数据、认证 |

## 常见错误

| 错误 | 修复 |
|------|------|
| `out/` 不存在 | 检查 `output: 'export'` 配置 |
| Token 失效 | 重新 `edgeone login` |
| 部署超时 | 改用 CNB 流水线，避开本地网络 |
| 环境变量丢失 | SSR 需在控制台手动配置 |
| 区域不一致 | `area` 必须与已有项目一致 |
| Node 版本过低 | CNB 使用 `image: node:20` |

## 质量检查

- [ ] 项目类型正确识别（SSG/SSR）
- [ ] 部署产物目录存在（`out/` 或 `.next/`）
- [ ] 区域与 name 参数完整
- [ ] SSR 环境变量已配置
- [ ] 部署 URL 可访问

---

**版本**：v1.0-lite
**更新**：2025-12-06
