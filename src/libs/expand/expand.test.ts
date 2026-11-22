import { describe, expect, it } from 'vitest';

import { parseReference, resolveReference } from './expand';

describe('parseReference', () => {
  it.each([
    ['NAME', { name: 'NAME', fallback: undefined, fallbackOnEmpty: false }],
    ['NAME:-x', { name: 'NAME', fallback: 'x', fallbackOnEmpty: true }],
    ['NAME-x', { name: 'NAME', fallback: 'x', fallbackOnEmpty: false }],
    ['NAME:-', { name: 'NAME', fallback: '', fallbackOnEmpty: true }],
    ['NAME:-a-b', { name: 'NAME', fallback: 'a-b', fallbackOnEmpty: true }],
  ])('parses %j', (body, expected) => {
    expect(parseReference(body)).toEqual(expected);
  });

  it.each(['', '-x', ':-x', '1A', '__proto__', 'A B'])('rejects %j', (body) => {
    expect(parseReference(body)).toBeUndefined();
  });
});

describe('resolveReference', () => {
  const lookup = (name: string): string | undefined =>
    (({ SET: 'value', EMPTY: '' }) as Record<string, string>)[name];

  it.each([
    ['SET', 'value'],
    ['EMPTY', ''],
    ['UNSET', ''],
    ['SET:-f', 'value'],
    ['EMPTY:-f', 'f'],
    ['UNSET:-f', 'f'],
    ['EMPTY-f', ''],
    ['UNSET-f', 'f'],
  ])('resolves ${%s}', (body, expected) => {
    const reference = parseReference(body);
    expect(reference).toBeDefined();
    expect(resolveReference(reference!, lookup, {})).toBe(expected);
  });
});
