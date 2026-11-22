/** `Object.hasOwn` without requiring ES2022 (Hermes / older Safari). */
export const hasOwn = (object: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(object, key);

/** A dictionary with no prototype, so keys like `__proto__` or `toString` are plain data. */
export const createDict = <T>(): Record<string, T> =>
  Object.create(null) as Record<string, T>;

/** Reads an own property only: inherited members of `source` are never returned. */
export const getOwn = <T>(
  source: Readonly<Record<string, T>>,
  key: string,
): T | undefined => (hasOwn(source, key) ? source[key] : undefined);
