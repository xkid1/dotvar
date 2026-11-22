import type { EnvSource } from '../parser';

/** Outcome of converting one raw string. `message` must never include the raw value. */
export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

/** Options every validator accepts. */
export interface SpecOptions<T> {
  /** Used when the variable is missing (or empty, see `emptyAsUndefined`). */
  readonly default?: T;
  /** Allow the variable to be missing; its type then includes `undefined`. */
  readonly optional?: boolean;
  /**
   * Marks the value as sensitive: it is redacted from `JSON.stringify`, `console.log` /
   * `util.inspect` of the env object, and reading it in a client runtime throws.
   */
  readonly secret?: boolean;
  /** Free-form documentation, shown in validation errors. */
  readonly description?: string;
}

/** A validator: how to turn one raw string into a typed value. */
export interface Spec<T> {
  /** Validator name, e.g. `'number'`. */
  readonly kind: string;
  readonly parse: (raw: string) => ParseResult<Exclude<T, undefined>>;
  readonly default?: Exclude<T, undefined>;
  readonly optional: boolean;
  readonly secret: boolean;
  readonly description?: string;
}

/** The output type of a validator built from options `O`. */
export type SpecOutput<T, O> = O extends { readonly default: unknown }
  ? T
  : O extends { readonly optional: true }
    ? T | undefined
    : T;

/** Maps variable names (without prefix) to validators. */
export type Schema = Readonly<Record<string, Spec<unknown>>>;

/** The typed, frozen environment object produced from a schema. */
export type InferEnv<S extends Schema> = {
  readonly [K in keyof S]: S[K] extends Spec<infer T> ? T : never;
};

export interface CreateEnvOptions<S extends Schema> {
  /** Variable names (without `prefix`) mapped to validators. */
  readonly schema: S;
  /**
   * Where to read raw values from. Defaults to `globalThis.process.env` when it exists.
   * In browsers and React Native pass it explicitly (e.g. `import.meta.env`): bundlers
   * only inline variables that are referenced literally.
   */
  readonly source?: EnvSource;
  /**
   * Prepended to every schema key when reading the source, e.g. `'VITE_'` lets the schema
   * say `API_URL` while reading `VITE_API_URL`.
   */
  readonly prefix?: string;
  /**
   * Treat `''` as missing, so `KEY=` fails a required variable instead of passing silently.
   * @default true
   */
  readonly emptyAsUndefined?: boolean;
  /**
   * Allow `secret: true` variables in a browser / React Native runtime. Anything shipped to
   * a client is public, so only enable this if you understand that.
   * @default false
   */
  readonly allowSecretsOnClient?: boolean;
}

// ───────────── Validator-specific options ─────────────

export interface StringOptions extends SpecOptions<string> {
  readonly minLength?: number;
  readonly maxLength?: number;
  /** The value must match this pattern. Avoid patterns with nested quantifiers. */
  readonly pattern?: RegExp;
}

export interface NumberOptions extends SpecOptions<number> {
  readonly min?: number;
  readonly max?: number;
  /** Require an integer. */
  readonly integer?: boolean;
}

export type BooleanOptions = SpecOptions<boolean>;

export interface UrlOptions extends SpecOptions<string> {
  /** Allowed schemes including the trailing colon, e.g. `['https:']`. Any scheme if omitted. */
  readonly protocols?: readonly string[];
}

export type EmailOptions = SpecOptions<string>;

export interface ListOptions extends SpecOptions<readonly string[]> {
  /** @default ',' */
  readonly separator?: string;
  /** Minimum number of non-empty items. */
  readonly minItems?: number;
}

export type JsonOptions<T> = SpecOptions<T>;

export type OneOfOptions<T extends string> = SpecOptions<T>;
