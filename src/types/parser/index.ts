/** Any object that maps variable names to string values, e.g. `process.env` or `import.meta.env`. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/** The result of parsing a `.env` source: a frozen, prototype-free dictionary. */
export type ParsedEnv = Readonly<Record<string, string>>;

export interface ParseOptions {
  /**
   * Expand `${NAME}` and `${NAME:-fallback}` references in unquoted and double-quoted
   * values. Single-quoted and backtick-quoted values are always literal.
   * Only the braced form is supported, so a bare `$` (common in passwords) is never touched.
   * @default false
   */
  readonly expand?: boolean;
  /**
   * Fallback values for `${NAME}` references that are not defined earlier in the source.
   * Only read when `expand` is `true`.
   */
  readonly env?: EnvSource;
  /**
   * Maximum source length in characters. Larger input throws `ERR_DOTVAR_LIMIT` before parsing.
   * @default 1_048_576 (1 MiB)
   */
  readonly maxLength?: number;
}

/** Resolves a `${NAME}` reference. `local` holds the values parsed so far from the same source. */
export type ReferenceLookup = (name: string, local: ParsedEnv) => string | undefined;
