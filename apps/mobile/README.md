# Home Ledger H5 移动端（预留应用目录）

本目录为未来扩展 **H5 移动端记账应用** 的预留位置。

## 规划方案

- **技术栈**：Vue 3 + Vite + TypeScript + Tailwind CSS + Vant 4（移动端组件库）
- **零重复复用**：
  - 直接通过 workspace 依赖引用 `@home-ledger/shared`（复用所有领域枚举、DTO 类型、Zod 表单校验 Schema、金额精度计算与格式化函数）。
  - 当业务接口增多时，可将 `apps/web/src/api/` 抽离为 `packages/api-client` 供 `apps/web` 与 `apps/mobile` 共同调用。
- **后端兼容**：
  - `apps/api` 提供标准 RESTful API（`/api/v1/*`）与 JWT 鉴权，天然同时服务 PC Web 与 H5 移动端，只需在 `.env` 的 `CORS_ORIGIN` 中以逗号追加移动端域名即可。
