import { isValidKey } from '@utils';

import type { ParsedEnv, ReferenceLookup } from '@types';

/** A parsed `${…}` reference. */
export interface Reference {
  readonly name: string;
  /** Text after `:-` / `-`, or `undefined` when there is no fallback. */
  readonly fallback: string | undefined;
  /** `:-` also applies the fallback to empty values; `-` only to unset ones. */
  readonly fallbackOnEmpty: boolean;
}

/**
 * Splits the body of `${…}` (without the braces) into name and fallback.
 * Returns `undefined` for an invalid name, so the caller can report a parse error.
 */
export const parseReference = (body: string): Reference | undefined => {
  const dash = body.indexOf('-');
  const colon = dash > 0 && body.charCodeAt(dash - 1) === 58; /* ':' */
  const nameEnd = dash === -1 ? body.length : dash - (colon ? 1 : 0);
  const name = body.slice(0, nameEnd);
  // Names in references cannot contain '-' (that starts the fallback).
  if (!isValidKey(name)) return undefined;
  return {
    name,
    fallback: dash === -1 ? undefined : body.slice(dash + 1),
    fallbackOnEmpty: colon,
  };
};

/** Resolves a reference to its replacement text (`''` when unset and without fallback). */
export const resolveReference = (
  reference: Reference,
  lookup: ReferenceLookup,
  local: ParsedEnv,
): string => {
  const value = lookup(reference.name, local);
  if (reference.fallback === undefined) return value ?? '';
  if (value === undefined || (reference.fallbackOnEmpty && value === '')) {
    return reference.fallback;
  }
  return value;
};
