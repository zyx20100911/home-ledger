import { z } from 'zod';

const WEAK_JWT_SECRETS = new Set([
  'dev-only-jwt-secret-please-change',
  'change-me-to-a-strong-random-secret',
]);

function booleanEnv(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (typeof value === 'boolean') return value;
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === '') return defaultValue;
      if (['true', '1', 'yes'].includes(normalized)) return true;
      if (['false', '0', 'no'].includes(normalized)) return false;
    }
    return value;
  }, z.boolean());
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    API_PREFIX: z.string().default('api/v1'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    DATABASE_URL: z
      .string()
      .default(
        'postgresql://home_ledger:home_ledger_dev_password@localhost:5432/home_ledger?schema=public',
      ),
    JWT_SECRET: z.string().min(8).default('dev-only-jwt-secret-please-change'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    ALLOW_REGISTRATION: booleanEnv(true),
    TRUST_PROXY: booleanEnv(false),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      const secret = data.JWT_SECRET.trim();
      if (secret.length < 32 || WEAK_JWT_SECRETS.has(secret)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message: '生产环境必须配置至少 32 位且非默认占位符的强随机 JWT_SECRET',
        });
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Environment validation failed: ${formatted}`);
  }
  return result.data;
}
