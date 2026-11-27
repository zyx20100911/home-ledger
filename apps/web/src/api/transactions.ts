import type {
  ApiResponse,
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
