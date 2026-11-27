import type { ApiResponse, CategoryDTO, CategoryType } from '@home-ledger/shared';
import { http, requestData } from './http';

export function fetchCategories(familyId: string, type?: CategoryType): Promise<CategoryDTO[]> {
  return requestData(
    http.get<ApiResponse<CategoryDTO[]>>(`/families/${familyId}/categories`, {
      params: type ? { type } : undefined,
    }),
  );
}

export function createCategory(
  familyId: string,
  payload: { name: string; type: CategoryType; color?: string },
): Promise<CategoryDTO> {
  return requestData(
    http.post<ApiResponse<CategoryDTO>>(`/families/${familyId}/categories`, payload),
  );
}

export function deleteCategory(familyId: string, categoryId: string): Promise<{ id: string }> {
  return requestData(
    http.delete<ApiResponse<{ id: string }>>(`/families/${familyId}/categories/${categoryId}`),
  );
}
