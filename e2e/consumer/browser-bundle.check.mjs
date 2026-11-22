// Runs the Vite browser bundle with browser-like globals: `document`, no `process`.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const bundle = process.argv[2];
const realProcess = globalThis.process;
globalThis.document = {};
Object.defineProperty(globalThis, 'process', { value: undefined, configurable: true });

let env;
let parsed;
try {
  const { run, parse } = await import(pathToFileURL(bundle).href);
  env = run({ VITE_API_URL: 'https://api.example.com', VITE_MODE: 'production' });
  parsed = parse('A=1');
} finally {
  Object.defineProperty(globalThis, 'process', {
    value: realProcess,
    configurable: true,
  });
}

assert.deepEqual({ ...env }, { API_URL: 'https://api.example.com', MODE: 'production' });
assert.deepEqual({ ...parsed }, { A: '1' });
console.log('browser bundle: OK');
