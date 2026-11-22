/** Placeholder shown instead of a secret value. */
export const REDACTED = '[REDACTED]';

/**
 * A copy of `values` with the listed keys replaced by `REDACTED` (missing values stay
 * `undefined`, so you can still see that a secret is unset).
 */
export const redactValues = (
  values: Readonly<Record<string, unknown>>,
  secretKeys: ReadonlySet<string>,
): Record<string, unknown> => {
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(values)) {
    const value = values[key];
    copy[key] = secretKeys.has(key) && value !== undefined ? REDACTED : value;
  }
  return copy;
};
