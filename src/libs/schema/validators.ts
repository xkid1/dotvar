import { DotvarError } from '../errors';

import type {
  BooleanOptions,
  EmailOptions,
  JsonOptions,
  ListOptions,
  NumberOptions,
  OneOfOptions,
  ParseResult,
  Spec,
  SpecOptions,
  SpecOutput,
  StringOptions,
  UrlOptions,
} from '@types';

const ok = <T>(value: T): ParseResult<T> => ({ ok: true, value });
const fail = (message: string): ParseResult<never> => ({ ok: false, message });

/** Builds a frozen `Spec` from a kind, a parser and the shared options. */
export const makeSpec = <T>(
  kind: string,
  parse: (raw: string) => ParseResult<T>,
  options: SpecOptions<T> = {},
): Spec<T> => {
  const spec: {
    kind: string;
    parse: (raw: string) => ParseResult<T>;
    optional: boolean;
    secret: boolean;
    default?: T;
    description?: string;
  } = {
    kind,
    parse,
    optional: options.optional === true,
    secret: options.secret === true,
  };
  if (options.default !== undefined) spec.default = options.default;
  if (options.description !== undefined) spec.description = options.description;
  return Object.freeze(spec) as Spec<T>;
};

const assertNumberOption = (name: string, value: number | undefined): void => {
  if (value !== undefined && !Number.isFinite(value)) {
    throw new DotvarError('ERR_DOTVAR_OPTION', `"${name}" must be a finite number`);
  }
};

// ───────────── string ─────────────

/** Any string, optionally length- or pattern-checked. */
export const string = <const O extends StringOptions = StringOptions>(
  options?: O,
): Spec<SpecOutput<string, O>> => {
  const { minLength, maxLength, pattern } = options ?? {};
  assertNumberOption('minLength', minLength);
  assertNumberOption('maxLength', maxLength);
  return makeSpec(
    'string',
    (raw) => {
      if (minLength !== undefined && raw.length < minLength) {
        return fail(`must be at least ${minLength} characters long`);
      }
      if (maxLength !== undefined && raw.length > maxLength) {
        return fail(`must be at most ${maxLength} characters long`);
      }
      if (pattern) {
        pattern.lastIndex = 0; // a /g or /y pattern would otherwise keep state between calls
        if (!pattern.test(raw)) return fail('does not match the required pattern');
      }
      return ok(raw);
    },
    options,
  ) as Spec<SpecOutput<string, O>>;
};

// ───────────── number / integer / port ─────────────

const isDigit = (code: number): boolean => code >= 48 && code <= 57;

/** Index after the run of digits starting at `index`. */
const skipDigits = (text: string, index: number): number => {
  let end = index;
  while (end < text.length && isDigit(text.charCodeAt(end))) end++;
  return end;
};

/**
 * Plain decimal notation only (`-1`, `2.5`, `.5`, `1e3`): rejects `''`, hex, binary,
 * `Infinity` and `NaN`, all of which `Number()` would accept. A scanner, not a regex,
 * so it is linear-time by construction.
 */
const isDecimal = (text: string): boolean => {
  let index = text.charCodeAt(0) === 43 || text.charCodeAt(0) === 45 ? 1 : 0; // + -
  const intEnd = skipDigits(text, index);
  let digits = intEnd - index;
  index = intEnd;
  if (text.charCodeAt(index) === 46) {
    // '.'
    const fracEnd = skipDigits(text, index + 1);
    digits += fracEnd - index - 1;
    index = fracEnd;
  }
  if (digits === 0) return false;
  if (text.charCodeAt(index) === 101 || text.charCodeAt(index) === 69) {
    // e E
    index++;
    if (text.charCodeAt(index) === 43 || text.charCodeAt(index) === 45) index++;
    const expEnd = skipDigits(text, index);
    if (expEnd === index) return false;
    index = expEnd;
  }
  return index === text.length;
};

const parseNumber = (raw: string, options: NumberOptions): ParseResult<number> => {
  const text = raw.trim();
  const value = Number(text);
  if (!isDecimal(text) || !Number.isFinite(value)) return fail('must be a number');
  if (options.integer === true && !Number.isSafeInteger(value)) {
    return fail('must be an integer');
  }
  if (options.min !== undefined && value < options.min) {
    return fail(`must be greater than or equal to ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    return fail(`must be less than or equal to ${options.max}`);
  }
  return ok(value);
};

/** A finite decimal number. */
export const number = <const O extends NumberOptions = NumberOptions>(
  options?: O,
): Spec<SpecOutput<number, O>> => {
  const resolved: NumberOptions = options ?? {};
  assertNumberOption('min', resolved.min);
  assertNumberOption('max', resolved.max);
  return makeSpec('number', (raw) => parseNumber(raw, resolved), options) as Spec<
    SpecOutput<number, O>
  >;
};

/** A safe integer. */
export const integer = <const O extends Omit<NumberOptions, 'integer'> = NumberOptions>(
  options?: O,
): Spec<SpecOutput<number, O>> => {
  const resolved: NumberOptions = { ...options, integer: true };
  assertNumberOption('min', resolved.min);
  assertNumberOption('max', resolved.max);
  return makeSpec('integer', (raw) => parseNumber(raw, resolved), options) as Spec<
    SpecOutput<number, O>
  >;
};

/** A TCP/UDP port: an integer from 1 to 65535. */
export const port = <const O extends SpecOptions<number> = SpecOptions<number>>(
  options?: O,
): Spec<SpecOutput<number, O>> =>
  makeSpec(
    'port',
    (raw) => {
      const result = parseNumber(raw, { integer: true, min: 1, max: 65_535 });
      return result.ok ? result : fail('must be a port number between 1 and 65535');
    },
    options,
  ) as Spec<SpecOutput<number, O>>;

// ───────────── boolean ─────────────

const TRUE_VALUES: ReadonlySet<string> = new Set(['true', '1', 'yes', 'on']);
const FALSE_VALUES: ReadonlySet<string> = new Set(['false', '0', 'no', 'off']);

/** `true/1/yes/on` or `false/0/no/off`, case-insensitive. */
export const boolean = <const O extends BooleanOptions = BooleanOptions>(
  options?: O,
): Spec<SpecOutput<boolean, O>> =>
  makeSpec(
    'boolean',
    (raw) => {
      const text = raw.trim().toLowerCase();
      if (TRUE_VALUES.has(text)) return ok(true);
      if (FALSE_VALUES.has(text)) return ok(false);
      return fail('must be a boolean (true/false, 1/0, yes/no, on/off)');
    },
    options,
  ) as Spec<SpecOutput<boolean, O>>;

// ───────────── url ─────────────

const SCHEME = /^([A-Za-z][\w+.-]*):/;

type UrlConstructor = new (input: string) => unknown;

/**
 * An absolute URL, returned as a string. The scheme is checked without `URL` getters,
 * which React Native's built-in `URL` does not implement.
 */
export const url = <const O extends UrlOptions = UrlOptions>(
  options?: O,
): Spec<SpecOutput<string, O>> => {
  const protocols = options?.protocols?.map((protocol) => protocol.toLowerCase());
  return makeSpec(
    'url',
    (raw) => {
      const scheme = SCHEME.exec(raw);
      if (!scheme || /\s/.test(raw)) return fail('must be an absolute URL');
      const protocol = `${(scheme[1] ?? '').toLowerCase()}:`;
      if (protocols && !protocols.includes(protocol)) {
        return fail(`must use one of these protocols: ${protocols.join(', ')}`);
      }
      const URLImpl = (globalThis as { URL?: UrlConstructor }).URL;
      if (URLImpl) {
        try {
          new URLImpl(raw);
        } catch {
          return fail('must be an absolute URL');
        }
      }
      return ok(raw);
    },
    options,
  ) as Spec<SpecOutput<string, O>>;
};

// ───────────── email ─────────────

/** A pragmatic e-mail check: `local@domain.tld`, no whitespace, exactly one `@`. */
export const email = <const O extends EmailOptions = EmailOptions>(
  options?: O,
): Spec<SpecOutput<string, O>> =>
  makeSpec(
    'email',
    (raw) => {
      const at = raw.indexOf('@');
      const domain = raw.slice(at + 1);
      const dot = domain.lastIndexOf('.');
      const valid =
        at > 0 &&
        !raw.includes('@', at + 1) &&
        !/\s/.test(raw) &&
        dot > 0 &&
        dot < domain.length - 1;
      return valid ? ok(raw) : fail('must be an e-mail address');
    },
    options,
  ) as Spec<SpecOutput<string, O>>;

// ───────────── oneOf ─────────────

/** One of a fixed set of strings (case-sensitive). Infers a union type. */
export const oneOf = <
  const C extends readonly [string, ...string[]],
  const O extends OneOfOptions<C[number]> = OneOfOptions<C[number]>,
>(
  choices: C,
  options?: O,
): Spec<SpecOutput<C[number], O>> => {
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new DotvarError('ERR_DOTVAR_OPTION', 'oneOf() needs at least one choice');
  }
  const allowed: ReadonlySet<string> = new Set(choices);
  return makeSpec(
    'oneOf',
    (raw) =>
      allowed.has(raw)
        ? ok(raw as C[number])
        : fail(`must be one of: ${choices.join(', ')}`),
    options,
  ) as Spec<SpecOutput<C[number], O>>;
};

// ───────────── list ─────────────

/** A separated list (default `,`), items trimmed and empty items dropped. Frozen array. */
export const list = <const O extends ListOptions = ListOptions>(
  options?: O,
): Spec<SpecOutput<readonly string[], O>> => {
  const separator = options?.separator ?? ',';
  if (separator.length === 0) {
    throw new DotvarError('ERR_DOTVAR_OPTION', '"separator" must not be empty');
  }
  const minItems = options?.minItems ?? 0;
  return makeSpec(
    'list',
    (raw) => {
      const items = raw
        .split(separator)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (items.length < minItems) return fail(`must have at least ${minItems} item(s)`);
      return ok<readonly string[]>(Object.freeze(items));
    },
    options,
  ) as Spec<SpecOutput<readonly string[], O>>;
};

// ───────────── json ─────────────

/** Drops `__proto__` keys so a parsed value can be merged into other objects safely. */
const safeReviver = (key: string, value: unknown): unknown =>
  key === '__proto__' ? undefined : value;

/**
 * JSON, parsed without `__proto__` keys. The type parameter is not checked at runtime;
 * validate the shape yourself if it comes from an untrusted source.
 *
 * Overloads (instead of an inferred options type) because callers usually pass `T`
 * explicitly, and TypeScript cannot infer the remaining type parameters in that case.
 */
export function json<T = unknown>(
  options: JsonOptions<T> & { readonly default: T },
): Spec<T>;
export function json<T = unknown>(
  options: JsonOptions<T> & { readonly optional: true },
): Spec<T | undefined>;
export function json<T = unknown>(options?: JsonOptions<T>): Spec<T>;
export function json<T = unknown>(options?: JsonOptions<T>): Spec<T> {
  return makeSpec<T>(
    'json',
    (raw) => {
      try {
        const value: unknown = JSON.parse(raw, safeReviver);
        return ok(value as T);
      } catch {
        return fail('must be valid JSON');
      }
    },
    options,
  );
}
