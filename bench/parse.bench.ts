// `yarn bench`: micro-benchmarks of the source (not dist), using Vitest 5's
// test-context `bench` API. For the built package across runtimes see bench/runtimes.mjs.
import { it } from 'vitest';

import { boolean, createEnv, list, parse, port, string, url } from '@libs';

const ENV_FILE = Array.from(
  { length: 200 },
  (_, i) => `KEY_${i}="value ${i}" # comment`,
).join('\n');
const UNQUOTED_FILE = Array.from({ length: 200 }, (_, i) => `KEY_${i}=value-${i}`).join(
  '\n',
);
const EXPAND_FILE = ['HOST=localhost', 'PORT=5432']
  .concat(
    Array.from({ length: 100 }, (_, i) => `URL_${i}=postgres://\${HOST}:\${PORT}/db${i}`),
  )
  .join('\n');

it('parse', async ({ bench }) => {
  await bench.compare(
    bench('200 unquoted lines', () => {
      parse(UNQUOTED_FILE);
    }),
    bench('200 quoted lines with comments', () => {
      parse(ENV_FILE);
    }),
    bench('100 lines with expansion', () => {
      parse(EXPAND_FILE, { expand: true });
    }),
  );
});

it('createEnv', async ({ bench }) => {
  const source = {
    PORT: '8080',
    NAME: 'service',
    API_URL: 'https://api.example.com',
    DEBUG: 'true',
    HOSTS: 'a,b,c',
  };
  const schema = {
    PORT: port(),
    NAME: string(),
    API_URL: url(),
    DEBUG: boolean(),
    HOSTS: list(),
  };
  await bench('5 variables', () => {
    createEnv({ source, schema });
  }).run();
});
