import { describe, expect, it, vi } from 'vitest';

import {
  createDict,
  getOwn,
  getProcessEnv,
  hasOwn,
  isClientRuntime,
  isForbiddenKey,
  isValidKey,
  REDACTED,
  redactValues,
} from '@utils';

/** Runs `fn` with `globalThis.process` replaced, restoring it before returning. */
const withProcess = <T>(value: unknown, fn: () => T): T => {
  const original = globalThis.process;
  Object.defineProperty(globalThis, 'process', {
    value,
    configurable: true,
    writable: true,
  });
  try {
    return fn();
  } finally {
    Object.defineProperty(globalThis, 'process', {
      value: original,
      configurable: true,
      writable: true,
    });
  }
};

describe('helpers', () => {
  it('hasOwn / getOwn ignore inherited members', () => {
    const object = Object.create({ inherited: 1 }) as Record<string, number>;
    object['own'] = 2;
    expect(hasOwn(object, 'own')).toBe(true);
    expect(hasOwn(object, 'inherited')).toBe(false);
    expect(getOwn(object, 'own')).toBe(2);
    expect(getOwn(object, 'inherited')).toBeUndefined();
    expect(getOwn({}, 'toString')).toBeUndefined();
  });

  it('createDict has no prototype', () => {
    const dict = createDict<string>();
    expect(Object.getPrototypeOf(dict)).toBeNull();
    expect('toString' in dict).toBe(false);
  });
});

describe('security', () => {
  it.each(['A', '_a', 'a.b', 'a-b', 'A1_'])('accepts key %s', (key) => {
    expect(isValidKey(key)).toBe(true);
  });

  it.each([
    '',
    '1A',
    '-a',
    'a b',
    'a=b',
    '__proto__',
    'constructor',
    'prototype',
    'é',
    'K'.repeat(257),
  ])('rejects key %j', (key) => {
    expect(isValidKey(key)).toBe(false);
  });

  it('flags forbidden keys', () => {
    expect(isForbiddenKey('__proto__')).toBe(true);
    expect(isForbiddenKey('proto')).toBe(false);
  });

  it('redacts only set secret values', () => {
    expect(redactValues({ A: 'x', B: 'y', C: undefined }, new Set(['A', 'C']))).toEqual({
      A: REDACTED,
      B: 'y',
      C: undefined,
    });
  });
});

describe('runtime', () => {
  it('returns process.env in Node', () => {
    expect(getProcessEnv()).toBe(process.env);
  });

  it('returns undefined without a usable process', () => {
    // Restore inside the test: Vitest's worker needs `process` again right after it.
    const env = withProcess(undefined, getProcessEnv);
    const nullEnv = withProcess({ env: null }, getProcessEnv);
    expect(env).toBeUndefined();
    expect(nullEnv).toBeUndefined();
  });

  it('is not a client runtime in Node', () => {
    expect(isClientRuntime()).toBe(false);
  });

  it('detects browsers, React Native and web workers', () => {
    vi.stubGlobal('document', {});
    expect(isClientRuntime()).toBe(true);
    vi.unstubAllGlobals();

    vi.stubGlobal('navigator', { product: 'ReactNative' });
    expect(isClientRuntime()).toBe(true);
    vi.unstubAllGlobals();

    vi.stubGlobal('importScripts', () => undefined);
    expect(isClientRuntime()).toBe(false); // Node with importScripts is still Node
    expect(withProcess(undefined, isClientRuntime)).toBe(true);
  });
});
