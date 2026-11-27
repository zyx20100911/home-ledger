import type { ApiResponse, HealthCheckResponse } from '@home-ledger/shared';
import { http, requestData } from './http';

export function fetchHealth(): Promise<HealthCheckResponse> {
  return requestData(http.get<ApiResponse<HealthCheckResponse>>('/health'));
}
