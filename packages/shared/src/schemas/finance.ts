import { z } from 'zod';
import { AccountType, BudgetPeriod, CategoryType } from '../enums/finance';

export const signedMoneyStringSchema = z
  .string()
  .trim()
  .regex(/^-?\d{1,12}(\.\d{1,2})?$/, '金额格式不正确，最多保留两位小数');

export const nonNegativeMoneyStringSchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, '金额格式不正确，最多保留两位小数');

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, '请输入账户名称').max(40, '账户名称不能超过 40 字'),
  type: z.enum([
    AccountType.CASH,
    AccountType.BANK_CARD,
    AccountType.ALIPAY,
    AccountType.WECHAT,
    AccountType.CREDIT_CARD,
    AccountType.INVESTMENT,
    AccountType.MEDICAL_INSURANCE,
    AccountType.SOCIAL_SECURITY,
    AccountType.INSURANCE,
    AccountType.DEBT,
    AccountType.OTHER,
  ]),
  balance: signedMoneyStringSchema.default('0.00'),
  includeInNetWorth: z.boolean().default(true),
  institution: z.string().trim().max(60, '机构名称不能超过 60 字').optional().nullable(),
  coverageAmount: nonNegativeMoneyStringSchema.optional().nullable(),
  renewalDate: z.string().datetime({ message: '续保日期格式需为 ISO 8601' }).optional().nullable(),
  note: z.string().max(200).optional().nullable(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, '请输入分类名称').max(24, '分类名称不能超过 24 字'),
  type: z.enum([CategoryType.EXPENSE, CategoryType.INCOME]),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, '颜色格式需为十六进制，如 #10b981')
    .default('#10b981'),
  icon: z.string().max(40).optional().nullable(),
});

export const upsertBudgetSchema = z.object({
  categoryId: z.string().min(1).optional().nullable(),
  period: z.enum([BudgetPeriod.MONTHLY, BudgetPeriod.YEARLY]).default(BudgetPeriod.MONTHLY),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12).optional().nullable(),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,12}(\.\d{1,2})?$/, '预算金额格式不正确')
    .refine((val) => Number(val) > 0, '预算金额必须大于 0'),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>;
