// Runs against the INSTALLED tarball (node_modules/dotvar), exactly as users get it.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { inspect } from 'node:util';

import * as dotvar from 'dotvar';
import * as dotvarNode from 'dotvar/node';

test('universal entry exposes the documented API', () => {
  for (const name of [
    'createEnv',
    'parse',
    'string',
    'number',
    'integer',
    'port',
    'boolean',
    'url',
    'email',
    'oneOf',
    'list',
    'json',
    'makeSpec',
    'DotvarError',
    'EnvParseError',
    'EnvValidationError',
    'REDACTED',
  ]) {
    assert.ok(name in dotvar, `missing export ${name}`);
  }
  assert.equal('load' in dotvar, false, 'load must only be in dotvar/node');
});

test('dotvar/node re-exports the universal API plus load/read', () => {
  assert.equal(dotvarNode.createEnv, dotvar.createEnv, 'same module instance');
  assert.equal(typeof dotvarNode.load, 'function');
  assert.equal(typeof dotvarNode.read, 'function');
});

test('parse → createEnv round trip', () => {
  const source = dotvar.parse('PORT=8080\nDEBUG=on\nAPI_KEY="sk_123"\nHOSTS=a, b');
  const env = dotvar.createEnv({
    source,
    schema: {
      PORT: dotvar.port(),
      DEBUG: dotvar.boolean(),
      API_KEY: dotvar.string({ secret: true }),
      HOSTS: dotvar.list(),
    },
  });
  assert.deepEqual(
    { ...env },
    { PORT: 8080, DEBUG: true, API_KEY: 'sk_123', HOSTS: ['a', 'b'] },
  );
  assert.ok(!JSON.stringify(env).includes('sk_123'));
  assert.ok(!inspect(env).includes('sk_123'));
});

test('validation errors are aggregated and value-free', () => {
  assert.throws(
    () =>
      dotvar.createEnv({
        source: { PORT: 'secret-ish' },
        schema: { PORT: dotvar.port(), URL: dotvar.url() },
      }),
    (error) => {
      assert.ok(error instanceof dotvar.EnvValidationError);
      assert.equal(error.code, 'ERR_DOTVAR_VALIDATION');
      assert.equal(error.issues.length, 2);
      assert.ok(!error.message.includes('secret-ish'));
      return true;
    },
  );
});

test('load() reads the .env cascade from disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dotvar-e2e-load-'));
  try {
    writeFileSync(join(dir, '.env'), 'A=base\nB=base');
    writeFileSync(join(dir, '.env.production'), 'B=prod');
    const target = {};
    const result = dotvarNode.load({ cwd: dir, mode: 'production', target });
    assert.deepEqual(target, { A: 'base', B: 'prod' });
    assert.equal(result.files.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('prototype pollution is rejected', () => {
  assert.throws(() => dotvar.parse('__proto__=x'), dotvar.EnvParseError);
  assert.equal({}.x, undefined);
});
