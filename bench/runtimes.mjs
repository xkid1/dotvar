// Runs the portable benchmark against the BUILT package (run `yarn build` first) in
// several runtimes and prints a Markdown table of operations per second.
//
//   node bench/runtimes.mjs --runtimes=node,bun,deno,chromium,firefox,webkit --time=1000
//   node bench/runtimes.mjs --json=bench.json
//
// Browsers need Playwright, which is NOT a devDependency (keeps the lockfile lean):
// install it anywhere and point PLAYWRIGHT_DIR at that directory, e.g.
//   mkdir /tmp/pw && cd /tmp/pw && npm i playwright@1 && npx playwright install
//   PLAYWRIGHT_DIR=/tmp/pw node bench/runtimes.mjs --runtimes=chromium,firefox,webkit
// Shared CI runners are noisy: compare runs with each other, not with absolute numbers.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { DIST, ROOT } from '../scripts/lib.mjs';

const BROWSERS = new Set(['chromium', 'firefox', 'webkit']);
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
  }),
);
const runtimes = (args.runtimes ?? 'node').split(',').filter(Boolean);
const time = Number(args.time ?? 1000);

if (!existsSync(join(DIST, 'index.js'))) {
  console.error('bench: dist/ is missing; run `yarn build` first');
  process.exit(1);
}

const COMMANDS = {
  node: [process.execPath, ['bench/runtime-entry.mjs', String(time)]],
  bun: ['bun', ['bench/runtime-entry.mjs', String(time)]],
  deno: ['deno', ['run', '--allow-read', 'bench/runtime-entry.mjs', String(time)]],
};

const runProcess = (runtime) => {
  const [command, commandArgs] = COMMANDS[runtime];
  const result = spawnSync(command, commandArgs, { cwd: ROOT, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(`${runtime} failed: ${result.error?.message ?? result.stderr}`);
  }
  return JSON.parse(result.stdout.trim().split('\n').at(-1));
};

/** Serves the repo root read-only (dist/ and bench/) for the browser runs. */
const serve = () =>
  new Promise((resolve) => {
    const types = {
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.html': 'text/html',
    };
    const server = createServer((request, response) => {
      const path = normalize(
        join(ROOT, decodeURIComponent(new URL(request.url, 'http://x').pathname)),
      );
      const allowed = [DIST, join(ROOT, 'bench')].some((dir) =>
        path.startsWith(dir + sep),
      );
      if (!allowed || !existsSync(path)) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { 'content-type': types[extname(path)] ?? 'text/plain' });
      response.end(readFileSync(path));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });

const runBrowsers = async (names) => {
  if (names.length === 0) return {};
  const dir = process.env.PLAYWRIGHT_DIR;
  if (!dir)
    throw new Error('Set PLAYWRIGHT_DIR to a directory with playwright installed');
  const require = createRequire(join(dir, 'package.json'));
  // Playwright is CommonJS: through import() its API may sit on `default`.
  const imported = await import(pathToFileURL(require.resolve('playwright')).href);
  const playwright = imported.chromium ? imported : imported.default;
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const results = {};
  try {
    for (const name of names) {
      const browser = await playwright[name].launch();
      try {
        const page = await browser.newPage();
        await page.goto(`${origin}/bench/portable.mjs`); // same origin for module imports
        results[name] = await page.evaluate(
          async ({ origin: base, time: ms }) => {
            const dotvar = await import(`${base}/dist/index.js`);
            const { runBench } = await import(`${base}/bench/portable.mjs`);
            return runBench(dotvar, ms);
          },
          { origin, time },
        );
      } finally {
        await browser.close();
      }
    }
  } finally {
    server.close();
  }
  return results;
};

const results = {};
for (const runtime of runtimes.filter((name) => !BROWSERS.has(name))) {
  if (!COMMANDS[runtime]) throw new Error(`Unknown runtime "${runtime}"`);
  results[runtime] = runProcess(runtime);
}
Object.assign(results, await runBrowsers(runtimes.filter((name) => BROWSERS.has(name))));

const names = Object.keys(results);
const cases = Object.keys(results[names[0]] ?? {});
console.log(`| Benchmark (ops/s) | ${names.join(' | ')} |`);
console.log(`| --- | ${names.map(() => '---:').join(' | ')} |`);
for (const name of cases) {
  console.log(
    `| ${name} | ${names.map((runtime) => results[runtime][name].toLocaleString('en-US')).join(' | ')} |`,
  );
}
if (args.json) writeFileSync(args.json, JSON.stringify(results, null, 2));
