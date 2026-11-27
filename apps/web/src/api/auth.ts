import type { ApiResponse, AuthResponseDTO, FamilyDTO, UserDTO } from '@home-ledger/shared';
import { http, requestData } from './http';

export function register(payload: {
  email: string;
  password: string;
  nickname: string;
  familyName?: string;
}): Promise<AuthResponseDTO> {
  return requestData(http.post<ApiResponse<AuthResponseDTO>>('/auth/register', payload));
}

export function login(payload: { email: string; password: string }): Promise<AuthResponseDTO> {
  return requestData(http.post<ApiResponse<AuthResponseDTO>>('/auth/login', payload));
}

export function fetchAuthConfig(): Promise<{ allowRegistration: boolean }> {
  return requestData(http.get<ApiResponse<{ allowRegistration: boolean }>>('/auth/config'));
}

export function fetchMe(): Promise<{ user: UserDTO; families: FamilyDTO[] }> {
  return requestData(http.get<ApiResponse<{ user: UserDTO; families: FamilyDTO[] }>>('/auth/me'));
}
