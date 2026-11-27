import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码长度至少为 6 位').max(64, '密码长度不能超过 64 位'),
  nickname: z.string().trim().min(1, '请输入昵称').max(30, '昵称不能超过 30 字'),
  familyName: z.string().trim().min(1).max(40).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
