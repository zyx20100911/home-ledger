import { z } from 'zod';
import { TransactionType } from '../enums/finance';

/** 金额字符串校验：最多 12 位整数 + 可选 1~2 位小数，且必须大于 0 */
export const positiveMoneyStringSchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, '金额格式不正确，最多保留两位小数')
  .refine((val) => Number(val) > 0, '金额必须大于 0');

export const createTransactionSchema = z
  .object({
    type: z.enum([TransactionType.EXPENSE, TransactionType.INCOME, TransactionType.TRANSFER]),
    amount: positiveMoneyStringSchema,
    accountId: z.string().min(1, '请选择资金账户'),
    toAccountId: z.string().min(1).optional().nullable(),
    categoryId: z.string().min(1).optional().nullable(),
    occurredAt: z.string().datetime({ message: '发生时间需为 ISO 8601 格式' }),
    note: z.string().max(300, '备注不能超过 300 字').optional().nullable(),
    tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.type === TransactionType.TRANSFER) {
      if (!data.toAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['toAccountId'],
          message: '转账类型必须指定转入账户',
        });
      }
      if (data.toAccountId && data.toAccountId === data.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['toAccountId'],
          message: '转出账户与转入账户不能相同',
        });
      }
    } else if (!data.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoryId'],
        message: '收支交易必须选择分类',
      });
    }
  });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
