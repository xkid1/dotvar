import { describe, expect, it } from 'vitest';

import { DotvarError } from '../errors';

import {
  boolean,
  email,
  integer,
  json,
  list,
  makeSpec,
  number,
  oneOf,
  port,
  string,
  url,
} from './validators';

import type { Spec } from '@types';

const accepts = <T>(spec: Spec<T>, raw: string): unknown => {
  const result = spec.parse(raw);
  if (!result.ok)
    throw new Error(`expected ${JSON.stringify(raw)} to pass: ${result.message}`);
  return result.value;
};

const rejects = <T>(spec: Spec<T>, raw: string): string => {
  const result = spec.parse(raw);
  if (result.ok) throw new Error(`expected ${JSON.stringify(raw)} to fail`);
  return result.message;
};

describe('makeSpec', () => {
  it('normalizes options into a frozen spec', () => {
    const spec = makeSpec('x', (raw) => ({ ok: true, value: raw }), {
      default: 'd',
      description: 'docs',
      secret: true,
    });
    expect(spec).toMatchObject({
      kind: 'x',
      default: 'd',
      description: 'docs',
      optional: false,
      secret: true,
    });
    expect(Object.isFrozen(spec)).toBe(true);
  });

  it('omits unset optional fields', () => {
    const spec = makeSpec('x', (raw) => ({ ok: true, value: raw }));
    expect('default' in spec).toBe(false);
    expect('description' in spec).toBe(false);
  });
});

describe('string', () => {
  it('accepts any string', () => {
    expect(accepts(string(), 'anything at all')).toBe('anything at all');
  });

  it('checks length', () => {
    const spec = string({ minLength: 2, maxLength: 3 });
    expect(rejects(spec, 'a')).toBe('must be at least 2 characters long');
    expect(rejects(spec, 'abcd')).toBe('must be at most 3 characters long');
    expect(accepts(spec, 'abc')).toBe('abc');
  });

  it('checks a pattern, even a stateful /g one, consistently', () => {
    const spec = string({ pattern: /^sk_/g });
    expect(accepts(spec, 'sk_1')).toBe('sk_1');
    expect(accepts(spec, 'sk_2')).toBe('sk_2');
    expect(rejects(spec, 'pk_1')).toBe('does not match the required pattern');
  });

  it('rejects invalid options', () => {
    expect(() => string({ minLength: Number.NaN })).toThrow(DotvarError);
  });
});

describe('number / integer / port', () => {
  it.each(['0', '-1', '+2', '3.5', '.5', '5.', '1e3', '1E-3', ' 42 '])(
    'number accepts %j',
    (raw) => {
      expect(accepts(number(), raw)).toBe(Number(raw));
    },
  );

  it.each(['', ' ', 'abc', '0x10', '0b1', 'Infinity', 'NaN', '1,000', '1e400', '--1'])(
    'number rejects %j',
    (raw) => {
      expect(rejects(number(), raw)).toBe('must be a number');
    },
  );

  it('number checks bounds', () => {
    const spec = number({ min: 1, max: 2 });
    expect(rejects(spec, '0')).toBe('must be greater than or equal to 1');
    expect(rejects(spec, '3')).toBe('must be less than or equal to 2');
    expect(accepts(spec, '1.5')).toBe(1.5);
  });

  it('integer rejects fractions and unsafe integers', () => {
    expect(accepts(integer(), '42')).toBe(42);
    expect(rejects(integer(), '1.5')).toBe('must be an integer');
    expect(rejects(integer(), '9007199254740993')).toBe('must be an integer');
    expect(rejects(integer({ min: 10 }), '5')).toBe(
      'must be greater than or equal to 10',
    );
  });

  it('number({ integer: true }) behaves like integer()', () => {
    expect(rejects(number({ integer: true }), '1.5')).toBe('must be an integer');
  });

  it.each(['1', '80', '65535'])('port accepts %s', (raw) => {
    expect(accepts(port(), raw)).toBe(Number(raw));
  });

  it.each(['0', '65536', '-1', '80.5', 'http'])('port rejects %s', (raw) => {
    expect(rejects(port(), raw)).toBe('must be a port number between 1 and 65535');
  });

  it('rejects non-finite bounds', () => {
    expect(() => number({ max: Number.POSITIVE_INFINITY })).toThrow(DotvarError);
    expect(() => integer({ min: Number.NaN })).toThrow(DotvarError);
  });
});

describe('boolean', () => {
  it.each(['true', 'TRUE', '1', 'yes', 'On', ' true '])('reads %j as true', (raw) => {
    expect(accepts(boolean(), raw)).toBe(true);
  });

  it.each(['false', 'False', '0', 'no', 'OFF'])('reads %j as false', (raw) => {
    expect(accepts(boolean(), raw)).toBe(false);
  });

  it.each(['', 'y', 'enabled', '2'])('rejects %j', (raw) => {
    expect(rejects(boolean(), raw)).toContain('must be a boolean');
  });
});

describe('url', () => {
  it.each([
    'https://example.com',
    'http://localhost:3000/a?b=c#d',
    'postgres://u:p@db:5432/app',
    'redis://h',
  ])('accepts %s', (raw) => {
    expect(accepts(url(), raw)).toBe(raw);
  });

  it.each(['example.com', '/relative', '', 'https://exa mple.com', 'http://[::1'])(
    'rejects %j',
    (raw) => {
      expect(rejects(url(), raw)).toBe('must be an absolute URL');
    },
  );

  it('restricts protocols case-insensitively', () => {
    const spec = url({ protocols: ['HTTPS:'] });
    expect(accepts(spec, 'HTTPS://x.io')).toBe('HTTPS://x.io');
    expect(rejects(spec, 'http://x.io')).toBe('must use one of these protocols: https:');
  });

  it('works without a global URL (older React Native)', () => {
    const original = globalThis.URL;
    // @ts-expect-error -- simulating a runtime without URL
    delete globalThis.URL;
    try {
      expect(accepts(url(), 'https://x.io')).toBe('https://x.io');
      expect(rejects(url(), 'nope')).toBe('must be an absolute URL');
    } finally {
      globalThis.URL = original;
    }
  });
});

describe('email', () => {
  it.each(['a@b.co', 'first.last+tag@sub.example.org'])('accepts %s', (raw) => {
    expect(accepts(email(), raw)).toBe(raw);
  });

  it.each(['', 'a', '@b.co', 'a@', 'a@b', 'a@b.', 'a@.b', 'a b@c.d', 'a@b@c.d'])(
    'rejects %j',
    (raw) => {
      expect(rejects(email(), raw)).toBe('must be an e-mail address');
    },
  );
});

describe('oneOf', () => {
  const spec = oneOf(['development', 'production']);

  it('accepts a listed choice', () => {
    expect(accepts(spec, 'production')).toBe('production');
  });

  it('is case-sensitive and lists choices', () => {
    expect(rejects(spec, 'Production')).toBe('must be one of: development, production');
  });

  it('requires at least one choice', () => {
    expect(() => oneOf([] as unknown as ['x'])).toThrow(DotvarError);
  });
});

describe('list', () => {
  it('splits, trims and drops empty items', () => {
    expect(accepts(list(), ' a, b ,,c ,')).toEqual(['a', 'b', 'c']);
  });

  it('returns a frozen array', () => {
    expect(Object.isFrozen(accepts(list(), 'a'))).toBe(true);
  });

  it('supports a custom separator and minimum', () => {
    expect(accepts(list({ separator: ';' }), 'a;b')).toEqual(['a', 'b']);
    expect(rejects(list({ minItems: 2 }), 'a')).toBe('must have at least 2 item(s)');
  });

  it('rejects an empty separator', () => {
    expect(() => list({ separator: '' })).toThrow(DotvarError);
  });
});

describe('json', () => {
  it('parses JSON', () => {
    expect(accepts(json(), '{"a":[1,2]}')).toEqual({ a: [1, 2] });
  });

  it('rejects invalid JSON without echoing it', () => {
    expect(rejects(json(), '{secret')).toBe('must be valid JSON');
  });

  it('drops __proto__ keys so merging the result cannot pollute prototypes', () => {
    const value = accepts(
      json(),
      '{"__proto__":{"polluted":true},"nested":{"__proto__":{"x":1}},"ok":1}',
    );
    const merged = Object.assign({}, value);
    expect(merged).toEqual({ nested: {}, ok: 1 });
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(Object.getPrototypeOf((value as { nested: object }).nested)).toBe(
      Object.prototype,
    );
  });
});
