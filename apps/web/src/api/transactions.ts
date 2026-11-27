import type {
  ApiResponse,
  BatchDeleteTransactionsResult,
  BatchImportTransactionsResult,
  BatchUpdateTransactionsResult,
  PaginatedData,
  TransactionDTO,
  TransactionType,
} from '@home-ledger/shared';
import { http, requestData } from './http';

export interface TransactionQueryParams {
  page?: number;
  pageSize?: number;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

export interface ExportTransactionsParams {
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
  ids?: string[];
}

export interface SaveTransactionPayload {
  type: TransactionType;
  amount: string;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  occurredAt: string;
  note?: string | null;
  tags?: string[];
}

export interface BatchUpdateTransactionsPayload {
  ids: string[];
  categoryId?: string;
  accountId?: string;
}

export function fetchTransactions(
  familyId: string,
  params: TransactionQueryParams = {},
): Promise<PaginatedData<TransactionDTO>> {
  return requestData(
    http.get<ApiResponse<PaginatedData<TransactionDTO>>>(`/families/${familyId}/transactions`, {
      params,
    }),
  );
}

export async function exportTransactionsCsv(
  familyId: string,
  params: ExportTransactionsParams = {},
): Promise<void> {
  const { ids, ...rest } = params;
  const response = await http.get<Blob>(`/families/${familyId}/transactions/export`, {
    params: {
      ...rest,
      ...(ids?.length ? { ids: ids.join(',') } : {}),
    },
    responseType: 'blob',
  });

  const disposition = response.headers['content-disposition'] as string | undefined;
  let filename = `home-ledger-transactions-${Date.now()}.csv`;
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

export function createTransaction(
  familyId: string,
  payload: SaveTransactionPayload,
): Promise<TransactionDTO> {
  return requestData(
    http.post<ApiResponse<TransactionDTO>>(`/families/${familyId}/transactions`, payload),
  );
}

export function updateTransaction(
  familyId: string,
  transactionId: string,
  payload: Partial<SaveTransactionPayload>,
): Promise<TransactionDTO> {
  return requestData(
    http.patch<ApiResponse<TransactionDTO>>(
      `/families/${familyId}/transactions/${transactionId}`,
      payload,
    ),
  );
}

export function deleteTransaction(
  familyId: string,
  transactionId: string,
): Promise<{ id: string }> {
  return requestData(
    http.delete<ApiResponse<{ id: string }>>(`/families/${familyId}/transactions/${transactionId}`),
  );
}

export function batchDeleteTransactions(
  familyId: string,
  ids: string[],
): Promise<BatchDeleteTransactionsResult> {
  return requestData(
    http.post<ApiResponse<BatchDeleteTransactionsResult>>(
      `/families/${familyId}/transactions/batch-delete`,
      { ids },
    ),
  );
}

export function batchUpdateTransactions(
  familyId: string,
  payload: BatchUpdateTransactionsPayload,
): Promise<BatchUpdateTransactionsResult> {
  return requestData(
    http.post<ApiResponse<BatchUpdateTransactionsResult>>(
      `/families/${familyId}/transactions/batch-update`,
      payload,
    ),
  );
}

export function batchImportTransactions(
  familyId: string,
  items: SaveTransactionPayload[],
): Promise<BatchImportTransactionsResult> {
  return requestData(
    http.post<ApiResponse<BatchImportTransactionsResult>>(
      `/families/${familyId}/transactions/batch-import`,
      { items },
    ),
  );
}
