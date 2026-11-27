/** 统一 API 响应信封结构 */
export interface ApiResponse<T = unknown> {
  /** 业务状态码: 0 表示成功，非 0 表示失败 */
  code: number;
  /** 提示信息 */
  message: string;
  /** 业务数据 */
  data: T;
  /** 服务端时间戳 (ISO 8601) */
  timestamp: string;
}

/** 分页查询参数 */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

/** 分页响应数据结构 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 健康检查响应 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  database: 'connected' | 'disconnected';
  uptimeSeconds: number;
}
