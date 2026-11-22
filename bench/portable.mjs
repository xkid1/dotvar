// Runtime-agnostic benchmark body: only standard globals (performance, JSON), so the very
// same file runs in Node, Bun, Deno and browsers. `dotvar` is the built universal entry.

const line = (i) => {
  switch (i % 5) {
    case 0:
      return `# section ${i}`;
    case 1:
      return `export KEY_${i}="quoted value with \\n escape ${i}"`;
    case 2:
      return `KEY_${i}='single ${i}'`;
    default:
      return `KEY_${i}=plain-value-${i} # comment`;
  }
};
const ENV_FILE = Array.from({ length: 50 }, (_, i) => line(i)).join('\n');

const EXPAND_FILE = ['HOST=localhost', 'PORT=5432', 'USER=app']
  .concat(
    Array.from(
      { length: 30 },
      (_, i) => `URL_${i}=postgres://\${USER}@\${HOST}:\${PORT}/db${i}`,
    ),
  )
  .join('\n');

const measure = (fn, timeMs) => {
  for (let i = 0; i < 200; i++) fn(); // warm-up
  let iterations = 0;
  const start = performance.now();
  let elapsed = 0;
  while (elapsed < timeMs) {
    for (let i = 0; i < 100; i++) fn();
    iterations += 100;
    elapsed = performance.now() - start;
  }
  return Math.round((iterations / elapsed) * 1000);
};

export const runBench = (dotvar, timeMs = 1000) => {
  const { createEnv, parse, port, string, url, boolean, list } = dotvar;
  const source = {
    PORT: '8080',
    NAME: 'service',
    API_URL: 'https://api.example.com/v1',
    DEBUG: 'false',
    HOSTS: 'a.example.com, b.example.com, c.example.com',
  };
  const schema = {
    PORT: port(),
    NAME: string(),
    API_URL: url(),
    DEBUG: boolean(),
    HOSTS: list(),
  };
  return {
    'parse (50 lines)': measure(() => parse(ENV_FILE), timeMs),
    'parse + expand (33 lines)': measure(
      () => parse(EXPAND_FILE, { expand: true }),
      timeMs,
    ),
    'createEnv (5 vars)': measure(() => createEnv({ source, schema }), timeMs),
  };
};
