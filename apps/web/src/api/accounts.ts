import type { AccountDTO, AccountSummaryDTO, AccountType, ApiResponse } from '@home-ledger/shared';
import { http, requestData } from './http';

export function fetchAccountSummary(
  familyId: string,
  includeArchived = false,
): Promise<AccountSummaryDTO> {
  return requestData(
    http.get<ApiResponse<AccountSummaryDTO>>(`/families/${familyId}/accounts`, {
      params: { includeArchived },
    }),
  );
}

export function createAccount(
  familyId: string,
  payload: {
    name: string;
    type: AccountType;
    balance: string;
    includeInNetWorth: boolean;
    note?: string;
  },
): Promise<AccountDTO> {
  return requestData(http.post<ApiResponse<AccountDTO>>(`/families/${familyId}/accounts`, payload));
}

export function updateAccount(
  familyId: string,
  accountId: string,
  payload: {
    name?: string;
    type?: AccountType;
    balance?: string;
    includeInNetWorth?: boolean;
    note?: string | null;
    isArchived?: boolean;
  },
): Promise<AccountDTO> {
  return requestData(
    http.patch<ApiResponse<AccountDTO>>(`/families/${familyId}/accounts/${accountId}`, payload),
  );
}
