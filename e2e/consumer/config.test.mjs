// `import 'dotvar/config'` and `node --import dotvar/config` populate process.env.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const withApp = (files, run) => {
  const dir = mkdtempSync(join(tmpdir(), 'dotvar-e2e-config-'));
  try {
    // Make the installed package resolvable from the temporary app directory.
    symlinkSync(resolve('node_modules'), join(dir, 'node_modules'), 'junction');
    for (const [name, content] of Object.entries(files))
      writeFileSync(join(dir, name), content);
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const node = (args, cwd, env = {}) =>
  spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, NODE_ENV: 'production', ...env },
  });

test('import "dotvar/config" loads .env before the app runs', () => {
  withApp(
    {
      '.env': 'GREETING=hello',
      'app.mjs': "import 'dotvar/config';\nconsole.log(process.env.GREETING);",
    },
    (dir) => {
      const result = node(['app.mjs'], dir);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), 'hello');
    },
  );
});

test('node --import dotvar/config, real environment wins', () => {
  withApp(
    { '.env': 'GREETING=from-file', 'app.mjs': 'console.log(process.env.GREETING);' },
    (dir) => {
      const result = node(['--import', 'dotvar/config', 'app.mjs'], dir, {
        GREETING: 'from-shell',
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), 'from-shell');
    },
  );
});

test('a malicious NODE_ENV cannot escape the directory', () => {
  withApp({ 'app.mjs': "import 'dotvar/config';" }, (dir) => {
    const result = node(['app.mjs'], dir, { NODE_ENV: '../../etc/passwd' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ERR_DOTVAR_OPTION|may only contain/);
  });
});
