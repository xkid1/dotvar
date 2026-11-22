// Fails (exit 1) unless dist/ is safe to publish:
//   1. no alias specifiers (@libs/@utils/@types) are left
//   2. zero runtime dependencies: JS imports only relative paths and `node:` built-ins,
//      and package.json has no dependencies / peerDependencies / optionalDependencies
//   3. every relative import resolves to a file in dist/
//   4. the universal entry (dist/index.js) never reaches a `node:` module, so it is safe
//      for browsers, workers and React Native
//   5. public .d.ts files do not reference Node typings (consumers need no @types/node)
//   6. every package.json "exports" target exists and every entry loads in Node
//   7. dist/ contains no tests or source maps
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { DIST, isAlias, isRelative, ROOT, SPECIFIER, walk } from './lib.mjs';

const errors = [];
const fail = (message) => errors.push(message);
const rel = (path) => relative(ROOT, path);

if (!existsSync(DIST)) {
  console.error('verify-dist: dist/ does not exist; run `yarn build` first');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
  if (pkg[field] && Object.keys(pkg[field]).length > 0) {
    fail(`package.json "${field}" must be empty (zero-dependency policy)`);
  }
}

/** Module specifiers of a file. */
const specifiers = (file) =>
  [...readFileSync(file, 'utf8').matchAll(SPECIFIER)].map((match) => match[3]);

const files = walk(DIST);
const graph = new Map(); // js file -> resolved relative deps + builtins

for (const file of files) {
  const isTypes = file.endsWith('.d.ts');
  const isJs = file.endsWith('.js');
  if (file.endsWith('.map')) fail(`${rel(file)}: source maps must not be published`);
  if (/\.(test|spec)\./.test(file)) fail(`${rel(file)}: tests must not be published`);
  if (!isTypes && !isJs) continue;

  const content = readFileSync(file, 'utf8');
  if (isTypes && /<reference\s+types=["']node["']/.test(content)) {
    fail(`${rel(file)}: references Node typings`);
  }

  const deps = [];
  const builtins = [];
  for (const specifier of specifiers(file)) {
    if (isAlias(specifier)) {
      fail(`${rel(file)}: unresolved alias "${specifier}"`);
    } else if (isRelative(specifier)) {
      if (!specifier.endsWith('.js'))
        fail(`${rel(file)}: "${specifier}" has no .js extension`);
      const target = join(dirname(file), specifier);
      const resolved = isTypes ? target.replace(/\.js$/, '.d.ts') : target;
      if (!existsSync(resolved)) fail(`${rel(file)}: "${specifier}" does not resolve`);
      deps.push(target);
    } else if (specifier.startsWith('node:')) {
      if (isTypes) fail(`${rel(file)}: public types import "${specifier}"`);
      builtins.push(specifier);
    } else {
      fail(`${rel(file)}: bare import "${specifier}" (zero-dependency policy)`);
    }
  }
  if (isJs) graph.set(file, { deps, builtins });
}

// 4. Universal entry graph must be free of node: built-ins.
const universal = join(DIST, 'index.js');
const seen = new Set();
const stack = [universal];
while (stack.length > 0) {
  const file = stack.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  const node = graph.get(file);
  if (!node) continue;
  for (const builtin of node.builtins) {
    fail(
      `dist/index.js reaches "${builtin}" through ${rel(file)}: the universal entry must run in browsers`,
    );
  }
  stack.push(...node.deps);
}

// 6. Exports targets exist and entries load.
const targets = [];
const collect = (value) => {
  if (typeof value === 'string') targets.push(value);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
};
collect(pkg.exports);
for (const target of targets) {
  if (!existsSync(join(ROOT, target)))
    fail(`package.json exports "${target}" does not exist`);
}

const expectExports = async (entry, names) => {
  const module = await import(pathToFileURL(join(DIST, entry)).href);
  for (const name of names) {
    if (!(name in module)) fail(`dist/${entry} does not export "${name}"`);
  }
};
const UNIVERSAL = [
  'createEnv',
  'parse',
  'string',
  'number',
  'port',
  'boolean',
  'url',
  'EnvValidationError',
];
await expectExports('index.js', UNIVERSAL);
await expectExports('node.js', [...UNIVERSAL, 'load', 'read']);

// dotvar/config has a side effect, so load it in an empty directory in a child process.
const sandbox = mkdtempSync(join(tmpdir(), 'dotvar-verify-'));
try {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `await import(${JSON.stringify(pathToFileURL(join(DIST, 'config.js')).href)});`,
    ],
    { cwd: sandbox, encoding: 'utf8' },
  );
  if (result.status !== 0) fail(`dist/config.js failed to load:\n${result.stderr}`);
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

if (errors.length > 0) {
  console.error(
    `verify-dist: ${errors.length} problem(s)\n${errors.map((e) => `  - ${e}`).join('\n')}`,
  );
  process.exit(1);
}
console.log(
  `verify-dist: OK (${files.length} files, universal graph: ${seen.size} modules, zero dependencies)`,
);
