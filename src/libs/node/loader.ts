import { resolve } from 'node:path';
import process from 'node:process';

import { createDict, getOwn, hasOwn } from '@utils';

import { DotvarError, EnvParseError } from '../errors';
import { assertLimit, DEFAULT_MAX_LENGTH, scan } from '../parser';

import { readEnvFile } from './file';

import type { ScanOptions } from '../parser';
import type {
  EnvTarget,
  LoadOptions,
  LoadResult,
  ParsedEnv,
  ReferenceLookup,
} from '@types';

/** Modes become part of a file name, so they are restricted to a safe alphabet. */
const MODE_PATTERN = /^[\w-]+$/;

const resolveMode = (mode: string | undefined): string | undefined => {
  if (mode === undefined || mode === '') return undefined;
  if (mode.length > 64 || !MODE_PATTERN.test(mode)) {
    throw new DotvarError(
      'ERR_DOTVAR_OPTION',
      '"mode" (or NODE_ENV) may only contain letters, digits, "_" and "-"',
    );
  }
  return mode;
};

/** `.env` < `.env.local` < `.env.<mode>` < `.env.<mode>.local` (later wins). */
const cascade = (mode: string | undefined): readonly string[] => [
  '.env',
  ...(mode === 'test' ? [] : ['.env.local']),
  ...(mode === undefined ? [] : [`.env.${mode}`, `.env.${mode}.local`]),
];

const toList = (path: string | readonly string[]): readonly string[] => {
  const paths = typeof path === 'string' ? [path] : path;
  if (
    paths.length === 0 ||
    paths.some((entry) => typeof entry !== 'string' || entry === '')
  ) {
    throw new DotvarError(
      'ERR_DOTVAR_OPTION',
      '"path" must be a non-empty string or list',
    );
  }
  return paths;
};

/**
 * `${NAME}` resolves to the value NAME will actually have after loading:
 * without `override` a pre-existing variable in `target` wins, with it the files win.
 */
const createLookup = (
  merged: ParsedEnv,
  target: EnvTarget | null,
  override: boolean,
): ReferenceLookup => {
  const existing = (name: string): string | undefined =>
    target ? getOwn(target, name) : undefined;
  return override
    ? (name, local) => getOwn(local, name) ?? getOwn(merged, name) ?? existing(name)
    : (name, local) => existing(name) ?? getOwn(local, name) ?? getOwn(merged, name);
};

/** Parses one file's content, adding the file path to parse errors. */
const parseFile = (content: string, file: string, options: ScanOptions): ParsedEnv => {
  try {
    return scan(content, options);
  } catch (error) {
    if (error instanceof EnvParseError) {
      throw new EnvParseError(error.reason, error.line, { code: error.code, file });
    }
    throw error;
  }
};

/** Copies `values` into `target`, keeping existing variables unless `override`. */
const apply = (values: ParsedEnv, target: EnvTarget, override: boolean): void => {
  for (const key of Object.keys(values)) {
    // Writing into the target (process.env by default) is this function's purpose.
    // eslint-disable-next-line no-param-reassign
    if (override || !hasOwn(target, key)) target[key] = values[key];
  }
};

/**
 * Loads `.env` files into `process.env` (or `target`). Node, Bun, Deno and Electron main only.
 *
 * Existing variables are never overwritten unless `override` is set, so real environment
 * configuration (CI, containers, the shell) always wins over files.
 *
 * @throws {EnvParseError} when a file is malformed (message has path and line, no content).
 * @throws {DotvarError} `ERR_DOTVAR_FILE`, `ERR_DOTVAR_LIMIT` or `ERR_DOTVAR_OPTION`.
 */
export const load = (options: LoadOptions = {}): LoadResult => {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_LENGTH;
  assertLimit('maxBytes', maxBytes);
  const cwd = options.cwd ?? process.cwd();
  const target = options.target === undefined ? process.env : options.target;
  const override = options.override === true;
  const required = options.required === true;
  const explicit = options.path !== undefined;
  const files =
    options.path === undefined
      ? cascade(resolveMode(options.mode ?? process.env['NODE_ENV']))
      : toList(options.path);

  const merged = createDict<string>();
  const scanOptions: ScanOptions = {
    expand: options.expand === true,
    maxLength: maxBytes,
    lookup: createLookup(merged, target, override),
  };
  const loaded: string[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    const absolute = resolve(cwd, file);
    const result = readEnvFile(absolute, maxBytes);
    if (result) {
      Object.assign(merged, parseFile(result.content, absolute, scanOptions));
      loaded.push(absolute);
      warnings.push(...result.warnings);
    } else if (explicit && required) {
      throw new DotvarError('ERR_DOTVAR_FILE', `${absolute} does not exist`);
    }
  }

  if (required && loaded.length === 0) {
    throw new DotvarError('ERR_DOTVAR_FILE', `No .env file found in ${cwd}`);
  }
  if (target) apply(merged, target, override);

  return Object.freeze({
    parsed: Object.freeze(merged),
    files: Object.freeze(loaded),
    warnings: Object.freeze(warnings),
  });
};

/**
 * Loads the default `.env` cascade into `process.env`.
 * @deprecated Kept for dotvar 1.x compatibility; use `load()`, which also returns what it loaded.
 */
export const read = (): void => {
  load();
};
