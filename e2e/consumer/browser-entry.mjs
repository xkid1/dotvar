// Entry for the Vite browser bundle built by e2e/run.mjs. Imports the universal entry the
// way a React / Vue / Svelte / Angular app would.
import { createEnv, oneOf, parse, url } from 'dotvar';

export const run = (source) =>
  createEnv({
    source,
    prefix: 'VITE_',
    schema: { API_URL: url(), MODE: oneOf(['development', 'production']) },
  });

export { parse };
