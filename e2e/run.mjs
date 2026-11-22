// End-user test suite. Run with `yarn e2e` (which builds first).
//
//   1. packs the package exactly as it will be published (`yarn pack` honours "files")
//   2. installs the tarball OFFLINE into a fresh consumer app — this only succeeds because
//      dotvar has zero dependencies
//   3. runs e2e/consumer/*.test.{mjs,cjs} with `node --test` against the installed package
//      (ESM, CommonJS require(esm), dotvar/node, dotvar/config, simulated browser and
//      React Native runtimes)
//   4. type-checks a TypeScript consumer with "moduleResolution" NodeNext and Bundler,
//      WITHOUT @types/node, proving the public types need no Node typings
//   5. bundles the universal entry for the browser with Vite and checks the bundle has no
//      Node built-ins, then runs the bundle
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ROOT } from '../scripts/lib.mjs';

const CONSUMER_SRC = join(ROOT, 'e2e', 'consumer');
const keep = process.argv.includes('--keep');

const run = (command, args, options = {}) => {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} exited with ${result.status ?? result.signal}`);
  }
};

const work = mkdtempSync(join(tmpdir(), 'dotvar-e2e-'));
const consumer = join(work, 'consumer');
const tarball = join(work, 'dotvar.tgz');

try {
  run('yarn', ['pack', '--out', tarball], { cwd: ROOT });

  cpSync(CONSUMER_SRC, consumer, { recursive: true });
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify(
      { name: 'dotvar-e2e-consumer', private: true, type: 'module' },
      null,
      2,
    ),
  );
  // --offline: any dependency would have to come from the network, so this fails if one exists.
  run(
    'npm',
    ['install', '--offline', '--no-audit', '--no-fund', '--no-package-lock', tarball],
    {
      cwd: consumer,
    },
  );

  const tests = readdirSync(consumer).filter((file) => /\.test\.(mjs|cjs)$/.test(file));
  run(process.execPath, ['--test', ...tests], { cwd: consumer });

  const tsc = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  for (const config of ['tsconfig.nodenext.json', 'tsconfig.bundler.json']) {
    run(process.execPath, [tsc, '-p', config], { cwd: consumer });
  }

  // Browser bundle with the repo's Vite (a devDependency of dotvar, not of the consumer).
  const { build } = await import(
    pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href
  );
  const outDir = join(consumer, 'dist-browser');
  const warnings = [];
  await build({
    root: consumer,
    logLevel: 'silent',
    configFile: false,
    customLogger: {
      info() {},
      warn: (message) => warnings.push(message),
      warnOnce: (message) => warnings.push(message),
      error: (message) => warnings.push(message),
      clearScreen() {},
      hasErrorLogged: () => false,
      hasWarned: false,
    },
    build: {
      outDir,
      minify: false,
      target: 'es2020',
      lib: {
        entry: join(consumer, 'browser-entry.mjs'),
        formats: ['es'],
        fileName: 'bundle',
      },
    },
  });
  const bundleFile = readdirSync(outDir).find((file) => file.endsWith('.js'));
  const bundle = (await import('node:fs')).readFileSync(join(outDir, bundleFile), 'utf8');
  if (
    /\bnode:/.test(bundle) ||
    warnings.some((w) => /externalized for browser/.test(w))
  ) {
    throw new Error('The browser bundle references Node built-ins');
  }
  run(process.execPath, ['browser-bundle.check.mjs', join(outDir, bundleFile)], {
    cwd: consumer,
  });

  console.log('\ne2e: all end-user checks passed');
} finally {
  if (keep) console.log(`\nKept ${work}`);
  else rmSync(work, { recursive: true, force: true });
}
