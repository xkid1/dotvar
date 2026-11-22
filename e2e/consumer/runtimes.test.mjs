// Simulates client runtimes in fresh Node processes. Runtime detection happens when
// createEnv() is called, so the simulated globals are installed after the import.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const evaluate = (setup) => {
  const code = `
    const { createEnv, string, url } = await import('dotvar');
    ${setup}
    const out = {};
    try {
      createEnv({ source: { KEY: 'x' }, schema: { KEY: string({ secret: true }) } });
      out.secret = 'allowed';
    } catch (error) { out.secret = error.code; }
    out.public = createEnv({
      source: { VITE_API_URL: 'https://api.example.com' },
      prefix: 'VITE_',
      schema: { API_URL: url() },
    }).API_URL;
    console.log(JSON.stringify(out));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};

test('browser: secrets are refused, public prefixed values work', () => {
  assert.deepEqual(evaluate('globalThis.document = {};'), {
    secret: 'ERR_DOTVAR_SECRET_ON_CLIENT',
    public: 'https://api.example.com',
  });
});

test('React Native (Hermes-like: no document, partial URL)', () => {
  const setup = `
    Object.defineProperty(globalThis, 'navigator', { value: { product: 'ReactNative' }, configurable: true });
    globalThis.URL = class { constructor() {} get protocol() { throw new Error('not implemented'); } };
  `;
  assert.deepEqual(evaluate(setup), {
    secret: 'ERR_DOTVAR_SECRET_ON_CLIENT',
    public: 'https://api.example.com',
  });
});

test('server (Node / Electron main): secrets are allowed', () => {
  assert.deepEqual(evaluate(''), {
    secret: 'allowed',
    public: 'https://api.example.com',
  });
});
