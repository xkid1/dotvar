import { inspect } from 'node:util';

import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { REDACTED } from '@utils';

import { DotvarError, EnvValidationError } from '../errors';

import { createEnv } from './create-env';
import { boolean, json, list, number, oneOf, port, string, url } from './validators';

const validationError = (run: () => unknown): EnvValidationError => {
  try {
    run();
  } catch (error) {
    if (error instanceof EnvValidationError) return error;
    throw error;
  }
  throw new Error('expected an EnvValidationError');
};

describe('createEnv', () => {
  it('parses values into a typed, frozen object', () => {
    const env = createEnv({
      source: {
        PORT: '8080',
        DEBUG: 'yes',
        API_URL: 'https://api.example.com',
        MODE: 'production',
      },
      schema: {
        PORT: port(),
        DEBUG: boolean(),
        API_URL: url(),
        MODE: oneOf(['development', 'production']),
      },
    });
    expect(env).toEqual({
      PORT: 8080,
      DEBUG: true,
      API_URL: 'https://api.example.com',
      MODE: 'production',
    });
    expect(Object.isFrozen(env)).toBe(true);
    expectTypeOf(env.PORT).toEqualTypeOf<number>();
    expectTypeOf(env.DEBUG).toEqualTypeOf<boolean>();
    expectTypeOf(env.MODE).toEqualTypeOf<'development' | 'production'>();
  });

  it('infers optional and default types', () => {
    const env = createEnv({
      source: {},
      schema: {
        A: string({ optional: true }),
        B: number({ default: 5 }),
        C: string({ optional: true, default: 'x' }),
        D: list({ optional: true }),
        E: json<{ a: number }>({ default: { a: 1 } }),
      },
    });
    expect(env).toEqual({ A: undefined, B: 5, C: 'x', D: undefined, E: { a: 1 } });
    expectTypeOf(env.A).toEqualTypeOf<string | undefined>();
    expectTypeOf(env.B).toEqualTypeOf<number>();
    expectTypeOf(env.C).toEqualTypeOf<string>();
    expectTypeOf(env.D).toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf(env.E).toEqualTypeOf<{ a: number }>();
  });

  it('infers json<T>() optionality even with an explicit type argument', () => {
    const env = createEnv({
      source: { J: '{"a":1}' },
      schema: {
        J: json<{ a: number }>(),
        OPT: json<{ a: number }>({ optional: true }),
        DEF: json<{ a: number }>({ optional: true, default: { a: 2 } }),
      },
    });
    expect(env).toEqual({ J: { a: 1 }, OPT: undefined, DEF: { a: 2 } });
    expectTypeOf(env.J).toEqualTypeOf<{ a: number }>();
    expectTypeOf(env.OPT).toEqualTypeOf<{ a: number } | undefined>();
    expectTypeOf(env.DEF).toEqualTypeOf<{ a: number }>();
  });

  it('reads prefixed variables', () => {
    const env = createEnv({
      source: { VITE_API_URL: 'https://x.io', API_URL: 'https://wrong.io' },
      prefix: 'VITE_',
      schema: { API_URL: url() },
    });
    expect(env.API_URL).toBe('https://x.io');
  });

  it('treats empty strings as missing by default', () => {
    const error = validationError(() =>
      createEnv({ source: { KEY: '' }, schema: { KEY: string() } }),
    );
    expect(error.issues).toEqual([{ key: 'KEY', message: 'is required but missing' }]);
    expect(
      createEnv({ source: { A: '' }, schema: { A: number({ default: 1 }) } }).A,
    ).toBe(1);
  });

  it('can keep empty strings', () => {
    const env = createEnv({
      source: { KEY: '' },
      schema: { KEY: string() },
      emptyAsUndefined: false,
    });
    expect(env.KEY).toBe('');
  });

  it('reports every problem at once, with prefixed keys and descriptions', () => {
    const error = validationError(() =>
      createEnv({
        source: { APP_PORT: 'eighty', APP_URL: 'not a url' },
        prefix: 'APP_',
        schema: {
          PORT: port(),
          URL: url(),
          TOKEN: string({ description: 'from the dashboard' }),
          FINE: string({ default: 'ok' }),
        },
      }),
    );
    expect(error.code).toBe('ERR_DOTVAR_VALIDATION');
    expect(error.issues).toEqual([
      { key: 'APP_PORT', message: 'must be a port number between 1 and 65535' },
      { key: 'APP_URL', message: 'must be an absolute URL' },
      { key: 'APP_TOKEN', message: 'is required but missing (from the dashboard)' },
    ]);
    expect(error.message).toContain('  - APP_PORT: must be a port number');
    expect(Object.isFrozen(error.issues)).toBe(true);
  });

  it('never includes values in errors', () => {
    const error = validationError(() =>
      createEnv({
        source: { PORT: 'hunter2' },
        schema: { PORT: port({ secret: true }) },
      }),
    );
    expect(error.message).not.toContain('hunter2');
    expect(JSON.stringify(error.issues)).not.toContain('hunter2');
  });

  it('rejects non-string source values', () => {
    const error = validationError(() =>
      createEnv({
        source: { A: 1 } as unknown as Record<string, string>,
        schema: { A: string() },
      }),
    );
    expect(error.issues[0]?.message).toBe('must be a string in the source');
  });

  it('ignores inherited source properties', () => {
    const source = Object.create({ INHERITED: 'x' }) as Record<string, string>;
    const env = createEnv({ source, schema: { INHERITED: string({ optional: true }) } });
    expect(env.INHERITED).toBeUndefined();
  });

  it('defaults to process.env', () => {
    vi.stubEnv('DOTVAR_TEST_VALUE', '7');
    expect(createEnv({ schema: { DOTVAR_TEST_VALUE: number() } }).DOTVAR_TEST_VALUE).toBe(
      7,
    );
  });

  it('works when there is no process global', () => {
    vi.stubGlobal('process', undefined);
    let env;
    try {
      env = createEnv({ schema: { A: string({ default: 'x' }) } });
    } finally {
      vi.unstubAllGlobals(); // Vitest's worker needs `process` back before the test ends
    }
    expect(env.A).toBe('x');
  });
});

describe('createEnv: secrets', () => {
  const make = () =>
    createEnv({
      source: { API_KEY: 'sk_live_123', PUBLIC: 'visible' },
      schema: {
        API_KEY: string({ secret: true }),
        PUBLIC: string(),
        UNSET: string({ secret: true, optional: true }),
      },
    });

  it('returns the real value on property access', () => {
    expect(make().API_KEY).toBe('sk_live_123');
  });

  it('redacts secrets in JSON.stringify, String() and util.inspect', () => {
    const env = make();
    expect(JSON.parse(JSON.stringify(env))).toEqual({
      API_KEY: REDACTED,
      PUBLIC: 'visible',
    });
    // eslint-disable-next-line @typescript-eslint/no-base-to-string -- testing our own toString
    expect(String(env)).toBe('[object Env]');
    expect(inspect(env)).not.toContain('sk_live_123');
    expect(inspect(env)).toContain(REDACTED);
  });

  it('keeps redaction hooks out of enumeration and spreading', () => {
    const env = make();
    expect(Object.keys(env)).toEqual(['API_KEY', 'PUBLIC', 'UNSET']);
    expect({ ...env }).toEqual({
      API_KEY: 'sk_live_123',
      PUBLIC: 'visible',
      UNSET: undefined,
    });
  });

  it('throws when a secret is read in a browser', () => {
    vi.stubGlobal('document', {});
    expect(() => make()).toThrow(
      expect.objectContaining({ code: 'ERR_DOTVAR_SECRET_ON_CLIENT' }),
    );
  });

  it('throws when a secret is read in React Native', () => {
    vi.stubGlobal('navigator', { product: 'ReactNative' });
    expect(() => make()).toThrow(DotvarError);
  });

  it('allows client secrets only when opted in', () => {
    vi.stubGlobal('document', {});
    const env = createEnv({
      source: { KEY: 'x' },
      schema: { KEY: string({ secret: true }) },
      allowSecretsOnClient: true,
    });
    expect(env.KEY).toBe('x');
  });

  it('hints at `source` when variables are missing on a client without one', () => {
    vi.stubGlobal('document', {});
    vi.stubGlobal('process', undefined);
    let error;
    try {
      error = validationError(() => createEnv({ schema: { API_URL: url() } }));
    } finally {
      vi.unstubAllGlobals();
    }
    expect(error.message).toContain('pass `source` explicitly');
  });
});

describe('createEnv: option validation', () => {
  it.each([
    [{ schema: null }, '"schema" must be an object'],
    [{ schema: { 'bad key': string() } }, '"bad key" is not a valid schema key'],
    [
      { schema: { __proto__x: string(), toJSON: string() } },
      '"toJSON" is not a valid schema key',
    ],
    [{ schema: { A: 'string' } }, 'Schema key "A" must be a validator'],
    [{ schema: {}, prefix: '' }, '"prefix" must be a valid variable-name prefix'],
    [{ schema: {}, prefix: '1X' }, '"prefix" must be a valid variable-name prefix'],
  ])('rejects %j', (options, message) => {
    expect(() => createEnv(options as never)).toThrow(
      expect.objectContaining({
        code: 'ERR_DOTVAR_OPTION',
        message: expect.stringContaining(message),
      }),
    );
  });
});
