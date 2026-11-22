// Shared helpers for the build scripts. Node built-ins only.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const DIST = join(ROOT, 'dist');

/**
 * Alias → directory inside dist/ (relative). Mirrors tsconfig.json "paths":
 * '@libs' and '@utils' allow one sub-folder ('@libs/node'); '@types' does not.
 */
export const ALIASES = { '@libs': 'libs', '@utils': 'utils', '@types': 'types' };
export const SUBPATH_ALIASES = new Set(['@libs', '@utils']);

/**
 * Module specifiers of real statements (so examples inside comments are ignored):
 * `import '…'`, `import … from '…'`, `export … from '…'` at the start of a line or right
 * after a closing `*\/` (swc keeps code on the comment's last line), and inline
 * `import('…')` type references that tsc emits in .d.ts files.
 * Groups: 1 = prefix, 2 = quote, 3 = specifier.
 */
export const SPECIFIER =
  /((?:^|\*\/)\s*import\s*|(?:^|\*\/)\s*(?:import|export)\b[^;'"]*?\bfrom\s*|\bimport\(\s*)(['"])([^'"\n]+)\2/gm;

/** Every file under `dir`, recursively. */
export const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

/** './x', '../x', and the bare '.' / '..' directory specifiers. */
export const isRelative = (specifier) =>
  specifier === '.' ||
  specifier === '..' ||
  specifier.startsWith('./') ||
  specifier.startsWith('../');

export const isAlias = (specifier) =>
  Object.keys(ALIASES).some(
    (alias) => specifier === alias || specifier.startsWith(`${alias}/`),
  );
