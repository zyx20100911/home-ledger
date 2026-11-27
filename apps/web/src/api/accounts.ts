import type {
  AccountDTO,
  AccountSummaryDTO,
  AccountType,
  ApiResponse,
  BatchImportAccountsResult,
} from '@home-ledger/shared';
import { http, requestData } from './http';

export interface SaveAccountPayload {
  name: string;
  type: AccountType;
  balance: string;
  includeInNetWorth: boolean;
  institution?: string | null;
  coverageAmount?: string | null;
  renewalDate?: string | null;
  note?: string | null;
}

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

export async function exportAccountsCsv(
  familyId: string,
  includeArchived = false,
): Promise<void> {
  const response = await http.get<Blob>(`/families/${familyId}/accounts/export`, {
    params: { includeArchived },
    responseType: 'blob',
  });

  const disposition = response.headers['content-disposition'] as string | undefined;
  let filename = `home-ledger-accounts-${Date.now()}.csv`;
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  if (match?.[1]) {
    filename = decodeURIComponent(match[1]);
  }

  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function createAccount(
  familyId: string,
  payload: SaveAccountPayload,
): Promise<AccountDTO> {
  return requestData(http.post<ApiResponse<AccountDTO>>(`/families/${familyId}/accounts`, payload));
}

export function updateAccount(
  familyId: string,
  accountId: string,
  payload: Partial<SaveAccountPayload> & { isArchived?: boolean },
): Promise<AccountDTO> {
  return requestData(
    http.patch<ApiResponse<AccountDTO>>(`/families/${familyId}/accounts/${accountId}`, payload),
  );
}

export function batchImportAccounts(
  familyId: string,
  payload: {
    duplicateStrategy: 'update' | 'skip';
    items: SaveAccountPayload[];
  },
): Promise<BatchImportAccountsResult> {
  return requestData(
    http.post<ApiResponse<BatchImportAccountsResult>>(
      `/families/${familyId}/accounts/batch-import`,
      payload,
    ),
  );
}
