# Home Ledger · 家庭财务管理系统

基于 **Vue 3 + NestJS + Prisma + PostgreSQL** 的全栈 TypeScript Monorepo 家庭财务管理系统。

前后端同语言开发，共享领域类型、校验规则与金额精度工具，架构清晰规范，并已为未来扩展 **H5 移动端** 预留完整复用路径。

## 技术栈

- **Monorepo 管理**：pnpm Workspaces
- **后端 (`apps/api`)**：NestJS 11 + Prisma 6 + PostgreSQL 16 + Swagger OpenAPI
- **前端 PC 端 (`apps/web`)**：Vue 3.5 + Vite 6 + TypeScript + Tailwind CSS v4 + Pinia + Vue Router 4
- **共享包 (`packages/shared`)**：TypeScript 领域枚举 / DTO / Zod 校验 / 精确金额工具
- **代码规范**：ESLint 9 (Flat Config) + Prettier + EditorConfig

## 目录结构

```text
home-ledger/
├── apps/
│   ├── api/                 # NestJS 后端 API (REST + Swagger + Prisma)
│   ├── web/                 # Vue 3 PC 管理端
│   └── mobile/              # 预留：未来 H5 移动端
├── packages/
│   ├── shared/              # 前后端与 H5 共享类型、Zod Schema、金额工具
│   └── tsconfig/            # 共享 TypeScript 基础配置
├── docs/
│   └── architecture.md      # 架构说明与 AI 友好开发规范
├── docker-compose.yml       # PostgreSQL 16 本地开发容器
├── pnpm-workspace.yaml
└── .env.example
```

## 快速开始

### 1. 环境准备

- Node.js `>= 20`
- pnpm `>= 9`
- Docker Desktop / Docker Engine（用于启动本地 PostgreSQL）

### 2. 安装依赖与配置环境变量

```bash
# 1) 复制环境变量模板
cp .env.example .env

# 2) 安装所有工作区依赖
pnpm install
```

### 3. 启动数据库并初始化表结构

```bash
# 启动 PostgreSQL 16 容器
pnpm db:up

# 生成 Prisma Client
pnpm db:generate

# 创建并应用数据库迁移（首次开发）
pnpm db:migrate

# 写入系统默认收支分类
pnpm db:seed
```

### 4. 启动前后端开发服务

```bash
pnpm dev
```

启动后访问：

- **Web 前端**：http://localhost:5173
- **后端 API**：http://localhost:3000/api/v1/health
- **Swagger 接口文档**：http://localhost:3000/api/docs
- **Prisma Studio（数据库可视化）**：运行 `pnpm db:studio`

## 常用命令

| 命令                          | 说明                             |
| ----------------------------- | -------------------------------- |
| `pnpm dev`                    | 并行启动后端与前端开发服务器     |
| `pnpm dev:api`                | 仅启动 NestJS 后端               |
| `pnpm dev:web`                | 仅启动 Vue 3 前端                |
| `pnpm build`                  | 按依赖顺序构建全部包与应用       |
| `pnpm typecheck`              | 全仓库 TypeScript 类型检查       |
| `pnpm lint`                   | 全仓库 ESLint 检查               |
| `pnpm format`                 | 使用 Prettier 格式化全部代码     |
| `pnpm test`                   | 运行全仓库单元测试               |
| `pnpm db:up` / `pnpm db:down` | 启动 / 停止 PostgreSQL 容器      |
| `pnpm db:generate`            | 重新生成 Prisma Client           |
| `pnpm db:migrate`             | 执行 Prisma 数据库迁移           |
| `pnpm db:seed`                | 初始化默认收支分类数据           |
| `pnpm db:studio`              | 打开 Prisma 数据库可视化管理界面 |
