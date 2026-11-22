// Post-build step: rewrites every module specifier in dist/*.js and dist/*.d.ts to an
// explicit relative path with a '.js' extension.
//
//   '@libs'        → './libs/index.js'
//   '@libs/node'   → '../libs/node/index.js'
//   './parser'     → './parser/index.js'  (directory)  or './parser.js' (file)
//
// The published package therefore needs no alias configuration and resolves the same way
// in Node ESM, TypeScript (NodeNext and Bundler), webpack, Vite, Metro and browsers.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { ALIASES, DIST, isRelative, SPECIFIER, SUBPATH_ALIASES, walk } from './lib.mjs';

const isDir = (path) => existsSync(path) && statSync(path).isDirectory();

/** Absolute target (without extension) for an alias specifier, or undefined. */
const aliasTarget = (specifier) => {
  for (const [alias, folder] of Object.entries(ALIASES)) {
    if (specifier === alias) return join(DIST, folder);
    if (specifier.startsWith(`${alias}/`)) {
      if (!SUBPATH_ALIASES.has(alias)) {
        throw new Error(`"${specifier}": ${alias} has no sub-path aliases`);
      }
      return join(DIST, folder, specifier.slice(alias.length + 1));
    }
  }
  return undefined;
};

/** Adds '.js' or '/index.js' to an extensionless absolute module path. */
const withExtension = (base, isTypes) => {
  if (base.endsWith('.js')) return base;
  const fileExt = isTypes ? '.d.ts' : '.js';
  if (existsSync(base + fileExt)) return `${base}.js`;
  if (isDir(base) && existsSync(join(base, `index${fileExt}`)))
    return join(base, 'index.js');
  throw new Error(`Cannot resolve "${base}" (${isTypes ? 'types' : 'js'})`);
};

const toRelative = (fromFile, absolute) => {
  const path = relative(dirname(fromFile), absolute).split(sep).join('/');
  return path.startsWith('.') ? path : `./${path}`;
};

let changedFiles = 0;
for (const file of walk(DIST)) {
  const isTypes = file.endsWith('.d.ts');
  if (!isTypes && !file.endsWith('.js')) continue;

  const source = readFileSync(file, 'utf8');
  const output = source.replace(SPECIFIER, (match, prefix, quote, specifier) => {
    const alias = aliasTarget(specifier);
    let absolute;
    if (alias) absolute = alias;
    else if (isRelative(specifier)) {
      absolute = join(dirname(file), specifier);
    } else return match; // node: built-ins (verify-dist rejects anything else)
    return `${prefix}${quote}${toRelative(file, withExtension(absolute, isTypes))}${quote}`;
  });

  if (output !== source) {
    writeFileSync(file, output);
    changedFiles++;
  }
}
console.log(`rewrite-aliases: updated ${changedFiles} file(s) in dist/`);
