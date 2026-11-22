/**
 * Valid variable names: a letter or `_`, then letters, digits, `_`, `.` or `-`.
 * Linear-time (no nested quantifiers).
 */
const KEY_PATTERN = /^[A-Za-z_][\w.-]*$/;

/** Names that would reach `Object.prototype` if a consumer copied the result naively. */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/** Longest accepted variable name. Real-world names are far shorter. */
export const MAX_KEY_LENGTH = 256;

export const isForbiddenKey = (key: string): boolean => FORBIDDEN_KEYS.has(key);

export const isValidKey = (key: string): boolean =>
  key.length <= MAX_KEY_LENGTH && KEY_PATTERN.test(key) && !isForbiddenKey(key);
