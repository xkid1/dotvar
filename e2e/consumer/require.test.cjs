// CommonJS consumers (older Electron main processes, Jest setups, legacy servers) load the
// ESM-only package through require(esm), available unflagged since Node 20.19 / 22.12.
const assert = require('node:assert/strict');
const { test } = require('node:test');

test('require("dotvar") works', () => {
  const { createEnv, string } = require('dotvar');
  const env = createEnv({ source: { NAME: 'x' }, schema: { NAME: string() } });
  assert.equal(env.NAME, 'x');
});

test('require("dotvar/node") works', () => {
  const { load } = require('dotvar/node');
  assert.equal(typeof load, 'function');
});
