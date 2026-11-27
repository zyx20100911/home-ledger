import type { ApiResponse, OverviewReportDTO } from '@home-ledger/shared';
import { http, requestData } from './http';

export function fetchOverviewReport(
  familyId: string,
  year: number,
  month: number,
): Promise<OverviewReportDTO> {
  return requestData(
    http.get<ApiResponse<OverviewReportDTO>>(`/families/${familyId}/reports/overview`, {
      params: { year, month },
    }),
  );
}
