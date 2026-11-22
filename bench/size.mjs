// Size report: each entry point bundled and minified with Vite (what an app ships when it
// imports everything from that entry), plus gzip and brotli sizes.
//
//   node bench/size.mjs                     table
//   node bench/size.mjs --check             also fail when over bench/size-budget.json
//   node bench/size.mjs --json=size.json    also write the numbers as JSON
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

import { build } from 'vite';

import { DIST, ROOT } from '../scripts/lib.mjs';

const ENTRIES = {
  'dotvar': 'index.js',
  'dotvar/node': 'node.js',
  'dotvar/config': 'config.js',
};
const args = process.argv.slice(2);
const check = args.includes('--check');
const jsonOut = args.find((arg) => arg.startsWith('--json='))?.slice('--json='.length);

const bundle = async (file) => {
  const output = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: true,
      target: 'es2020',
      lib: { entry: join(DIST, file), formats: ['es'], fileName: 'bundle' },
      rollupOptions: { external: [/^node:/] },
    },
  });
  const [result] = Array.isArray(output) ? output : [output];
  return Buffer.from(result.output.find((chunk) => chunk.type === 'chunk').code);
};

const measure = (code) => ({
  minified: code.length,
  gzip: gzipSync(code, { level: 9 }).length,
  brotli: brotliCompressSync(code, {
    params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
  }).length,
});

const budget = JSON.parse(readFileSync(join(ROOT, 'bench', 'size-budget.json'), 'utf8'));
const kb = (bytes) => `${(bytes / 1024).toFixed(2)} kB`;
const results = {};
const failures = [];

console.log('| Entry | Minified | Gzip | Brotli | Budget (brotli) |');
console.log('| --- | ---: | ---: | ---: | ---: |');
for (const [name, file] of Object.entries(ENTRIES)) {
  const size = measure(await bundle(file));
  results[name] = size;
  const limit = budget[name];
  if (check && limit !== undefined && size.brotli > limit) {
    failures.push(`${name}: ${kb(size.brotli)} brotli exceeds the ${kb(limit)} budget`);
  }
  console.log(
    `| \`${name}\` | ${kb(size.minified)} | ${kb(size.gzip)} | ${kb(size.brotli)} | ${limit === undefined ? '—' : kb(limit)} |`,
  );
}

if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 2));
if (failures.length > 0) {
  console.error(`\nSize budget exceeded:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
