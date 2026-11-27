import type { ApiResponse, BudgetDTO, BudgetPeriod, BudgetSummaryDTO } from '@home-ledger/shared';
import { http, requestData } from './http';

export function fetchBudgetSummary(
  familyId: string,
  year: number,
  month: number,
): Promise<BudgetSummaryDTO> {
  return requestData(
    http.get<ApiResponse<BudgetSummaryDTO>>(`/families/${familyId}/budgets`, {
      params: { year, month },
    }),
  );
}

export function upsertBudget(
  familyId: string,
  payload: {
    categoryId?: string | null;
    period?: BudgetPeriod;
    year: number;
    month: number;
    amount: string;
  },
): Promise<BudgetDTO> {
  return requestData(http.put<ApiResponse<BudgetDTO>>(`/families/${familyId}/budgets`, payload));
}

export function deleteBudget(familyId: string, budgetId: string): Promise<{ id: string }> {
  return requestData(
    http.delete<ApiResponse<{ id: string }>>(`/families/${familyId}/budgets/${budgetId}`),
  );
}
