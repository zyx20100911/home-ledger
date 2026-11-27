import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('provides sensible defaults in development mode', () => {
    const env = validateEnv({});

    expect(env.NODE_ENV).toBe('development');
    expect(env.ALLOW_REGISTRATION).toBe(true);
    expect(env.TRUST_PROXY).toBe(false);
    expect(env.JWT_SECRET).toBe('dev-only-jwt-secret-please-change');
  });

  it('parses boolean env strings accurately', () => {
    const env = validateEnv({
      ALLOW_REGISTRATION: 'false',
      TRUST_PROXY: '1',
    });

    expect(env.ALLOW_REGISTRATION).toBe(false);
    expect(env.TRUST_PROXY).toBe(true);
  });

  it('rejects weak or short JWT_SECRET in production mode', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'change-me-to-a-strong-random-secret',
      }),
    ).toThrow(/JWT_SECRET/);

    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'too-short-secret-123',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('accepts strong random JWT_SECRET in production mode', () => {
    const strongSecret = '9f8e7d6c5b4a3928172635445566778899aabbccddeeff00';
    const env = validateEnv({
      NODE_ENV: 'production',
      JWT_SECRET: strongSecret,
      ALLOW_REGISTRATION: 'no',
      TRUST_PROXY: 'yes',
    });

    expect(env.NODE_ENV).toBe('production');
    expect(env.JWT_SECRET).toBe(strongSecret);
    expect(env.ALLOW_REGISTRATION).toBe(false);
    expect(env.TRUST_PROXY).toBe(true);
  });
});
