import type {
  ApiResponse,
  FamilyDTO,
  FamilyInviteDTO,
  FamilyMemberDTO,
  FamilyRole,
} from '@home-ledger/shared';
import { http, requestData } from './http';

export function listFamilies(): Promise<FamilyDTO[]> {
  return requestData(http.get<ApiResponse<FamilyDTO[]>>('/families'));
}

export function createFamily(payload: { name: string; description?: string }): Promise<FamilyDTO> {
  return requestData(http.post<ApiResponse<FamilyDTO>>('/families', payload));
}

export function joinFamily(code: string): Promise<FamilyDTO> {
  return requestData(http.post<ApiResponse<FamilyDTO>>('/families/join', { code }));
}

export function listFamilyMembers(familyId: string): Promise<FamilyMemberDTO[]> {
  return requestData(http.get<ApiResponse<FamilyMemberDTO[]>>(`/families/${familyId}/members`));
}

export function createFamilyInvite(
  familyId: string,
  payload: { role?: FamilyRole; expiresInDays?: number; maxUses?: number } = {},
): Promise<FamilyInviteDTO> {
  return requestData(
    http.post<ApiResponse<FamilyInviteDTO>>(`/families/${familyId}/invites`, payload),
  );
}
