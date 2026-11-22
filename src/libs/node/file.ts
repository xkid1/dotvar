import { Buffer } from 'node:buffer';
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';
import process from 'node:process';

import { DotvarError } from '../errors';

/*
 * Synchronous on purpose: configuration is read once at startup, before anything else
 * runs, and callers expect `process.env` to be populated when `load()` returns.
 */
/* eslint-disable n/no-sync */

const IS_WINDOWS = process.platform === 'win32';

/**
 * Read-only, and non-blocking where supported so a FIFO or device node named `.env`
 * cannot hang startup (it is then rejected by the regular-file check below).
 */
const OPEN_FLAGS = IS_WINDOWS ? 'r' : constants.O_RDONLY | constants.O_NONBLOCK;

const errorCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : 'UNKNOWN';

export interface ReadResult {
  readonly content: string;
  /** Safe-to-log findings about the file (never its content). */
  readonly warnings: readonly string[];
}

/**
 * Reads a `.env` file safely. Returns `undefined` if it does not exist.
 *
 * The file is opened once and checked with `fstat` on the same descriptor, so it cannot
 * be swapped between the check and the read.
 */
export const readEnvFile = (path: string, maxBytes: number): ReadResult | undefined => {
  if (path.includes('\0')) {
    throw new DotvarError('ERR_DOTVAR_FILE', 'File path contains a NUL character');
  }

  let fd: number;
  try {
    // The path is the caller's own configuration (cwd + file name), never request input.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fd = openSync(path, OPEN_FLAGS);
  } catch (error) {
    const code = errorCode(error);
    if (code === 'ENOENT' || code === 'ENOTDIR') return undefined;
    throw new DotvarError('ERR_DOTVAR_FILE', `Cannot open ${path} (${code})`);
  }

  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) {
      throw new DotvarError('ERR_DOTVAR_FILE', `${path} is not a regular file`);
    }
    if (stat.size > maxBytes) {
      throw new DotvarError(
        'ERR_DOTVAR_LIMIT',
        `${path} exceeds the ${maxBytes}-byte limit`,
      );
    }

    const warnings: string[] = [];
    if (!IS_WINDOWS && (stat.mode & 0o002) !== 0) {
      warnings.push(
        `${path} is world-writable: any local user can change this configuration`,
      );
    }

    const buffer = Buffer.alloc(stat.size);
    let total = 0;
    while (total < buffer.length) {
      const bytes = readSync(fd, buffer, total, buffer.length - total, total);
      if (bytes === 0) break;
      total += bytes;
    }
    return { content: buffer.toString('utf8', 0, total), warnings };
  } catch (error) {
    if (error instanceof DotvarError) throw error;
    throw new DotvarError('ERR_DOTVAR_FILE', `Cannot read ${path} (${errorCode(error)})`);
  } finally {
    closeSync(fd);
  }
};
