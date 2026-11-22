/**
 * dotvar/node — load `.env` files from disk. Node >= 20.19, Bun, Deno, Electron main process.
 * Also re-exports the universal API, so server code needs a single import.
 *
 * @packageDocumentation
 */
export * from '.';
export { load, read } from '@libs/node';

export type { EnvTarget, LoadOptions, LoadResult } from '@types';
