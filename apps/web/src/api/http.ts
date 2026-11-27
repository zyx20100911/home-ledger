import axios from 'axios';
import type { ApiResponse } from '@home-ledger/shared';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('home_ledger_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    const payload = response.data as ApiResponse<unknown>;
    if (payload && typeof payload === 'object' && 'code' in payload) {
      if (payload.code !== 0) {
        return Promise.reject(new Error(payload.message || '请求失败'));
      }
      return response;
    }
    return response;
  },
  (error) => {
    const serverMessage = error.response?.data?.message;
    const message =
      typeof serverMessage === 'string' ? serverMessage : error.message || '网络异常，请稍后重试';
    return Promise.reject(new Error(message));
  },
);

/** 解包统一 ApiResponse<T> 结构，直接返回业务数据 */
export async function requestData<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await promise;
  return data.data;
}
