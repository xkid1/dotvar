import type { ParsedEnv } from '../parser';

/** A writable variable store, e.g. `process.env`. */
export type EnvTarget = Record<string, string | undefined>;

export interface LoadOptions {
  /**
   * File(s) to load, relative to `cwd` or absolute. Later files override earlier ones.
   * When omitted, the conventional cascade is loaded (missing files are skipped):
   * `.env`, `.env.local`, `.env.<mode>`, `.env.<mode>.local`
   * (`.env.local` is skipped when `mode` is `'test'`, so tests are reproducible).
   */
  readonly path?: string | readonly string[];
  /** Directory relative paths resolve against. @default process.cwd() */
  readonly cwd?: string;
  /**
   * Selects `.env.<mode>` files. Must match `/^[A-Za-z0-9_-]+$/` so it cannot be used for
   * path traversal. @default process.env.NODE_ENV
   */
  readonly mode?: string;
  /** Overwrite variables that already exist in `target`. @default false */
  readonly override?: boolean;
  /** Expand `${NAME}` references, see `ParseOptions.expand`. @default false */
  readonly expand?: boolean;
  /** Where loaded variables are written. Pass `null` to only return them. @default process.env */
  readonly target?: EnvTarget | null;
  /** Throw when no file was found (or, with `path`, when any listed file is missing). @default false */
  readonly required?: boolean;
  /** Maximum file size in bytes. @default 1_048_576 (1 MiB) */
  readonly maxBytes?: number;
}

export interface LoadResult {
  /** Merged values from every loaded file (before the `override` check). */
  readonly parsed: ParsedEnv;
  /** Absolute paths of the files that were read, in load order. */
  readonly files: readonly string[];
  /** Non-fatal findings, e.g. a world-writable `.env` file. Never contain values. */
  readonly warnings: readonly string[];
}
