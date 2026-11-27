# Home Ledger 架构与开发规范

本文档面向开发者与 AI 编程助手，定义本项目的核心架构约定，确保前后端代码长期保持规范、一致和可维护。

## 1. 整体架构概览

项目采用 **pnpm Workspaces** 全栈 TypeScript Monorepo 架构：

| 路径                | 包名                    | 职责                                                                                 |
| ------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `apps/api`          | `@home-ledger/api`      | NestJS 11 + Prisma 6 + PostgreSQL 16 后端 REST API 服务                              |
| `apps/web`          | `@home-ledger/web`      | Vue 3 + Vite 6 + TypeScript + Tailwind CSS v4 + Pinia PC 管理端                      |
| `apps/mobile`       | _(预留)_                | 未来 H5 移动端（Vue 3 + Vant 4），复用 `packages/*`                                  |
| `packages/shared`   | `@home-ledger/shared`   | 框架无关的领域枚举、DTO 类型、Zod 校验 Schema、金额精度工具（双格式 ESM + CJS 输出） |
| `packages/tsconfig` | `@home-ledger/tsconfig` | 统一 TypeScript 编译配置基线                                                         |

## 2. 财务系统核心工程规范

### 2.1 金额精度规范（严禁浮点运算）

- **数据库层**：PostgreSQL / Prisma 统一使用 `Decimal @db.Decimal(14, 2)` 存储金额。
- **接口传输层**：金额字段统一使用 **字符串**（如 `"128.50"`）序列化与传输，避免 JSON `number` 精度丢失。
- **运算与展示**：前后端均使用 `@home-ledger/shared` 提供的整数分工具（`yuanToCents`、`centsToYuan`、`addMoney`、`subMoney`、`formatMoney`）。
- **余额一致性**：任何涉及账户余额变动的记账、修改、删除操作，必须在 `prisma.$transaction(...)` 数据库事务内原子完成。

### 2.2 统一 API 响应信封

后端通过全局 `TransformInterceptor` 与 `HttpExceptionFilter` 统一响应格式（定义于 `@home-ledger/shared` 的 `ApiResponse<T>`）：

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

- 成功：`code === 0`
- 失败：`code !== 0`（通常为 HTTP 状态码），`message` 为可读错误提示

### 2.3 NestJS 后端模块规范

每个业务领域在 `apps/api/src/modules/<domain>/` 下按标准四层组织：

```text
modules/transactions/
├── dto/
│   ├── create-transaction.dto.ts
│   └── query-transaction.dto.ts
├── transactions.controller.ts   # 仅负责路由、参数解析、Swagger 注解与权限守卫
├── transactions.service.ts      # 核心业务逻辑、权限归属校验、Prisma 事务
├── transactions.module.ts       # 模块注册
└── transactions.service.spec.ts # 单元测试
```

**多家庭数据隔离原则**：

- 所有家庭业务查询与写操作必须显式校验 `familyId` 归属，确保当前登录用户是该家庭的有效成员（`FamilyMember`）。

### 2.4 Vue 3 前端模块规范

- 统一使用 `<script setup lang="ts">` 组合式 API。
- 接口调用统一放在 `apps/web/src/api/<domain>.ts`，通过 `requestData()` 自动解包 `ApiResponse<T>`。
- 页面级视图放在 `apps/web/src/views/<domain>/`，跨页面状态放在 `apps/web/src/stores/`。

## 3. 推荐业务迭代顺序

1. **Auth & Family 模块**：注册/登录（JWT + bcrypt）、自动创建默认家庭空间与成员角色校验
2. **Accounts & Categories 模块**：资金账户 CRUD + 系统预置分类查询与自定义分类
3. **Transactions 模块**：记一笔（支出/收入/转账）原子更新账户余额 + 分页筛选流水
4. **Budgets & Dashboard 统计模块**：月度收支趋势、分类占比图表、预算执行率
5. **H5 移动端 (`apps/mobile`)**：复用 `@home-ledger/shared` 与后端 API，聚焦快速记账场景
