# dotvar

[![CI](https://github.com/xkid1/dotvar/actions/workflows/ci.yml/badge.svg)](https://github.com/xkid1/dotvar/actions/workflows/ci.yml)
[![Tests](https://github.com/xkid1/dotvar/actions/workflows/test.yml/badge.svg)](https://github.com/xkid1/dotvar/actions/workflows/test.yml)
[![E2E](https://github.com/xkid1/dotvar/actions/workflows/e2e.yml/badge.svg)](https://github.com/xkid1/dotvar/actions/workflows/e2e.yml)
[![npm](https://img.shields.io/npm/v/dotvar)](https://www.npmjs.com/package/dotvar)
[![LICENSE](https://img.shields.io/github/license/xkid1/dotvar.svg)](LICENSE)

Type-safe, secure environment variables for **every JavaScript runtime**: Node, Bun, Deno,
browsers, React, Vue, Angular, Svelte, Electron and React Native.

- **Zero dependencies.** About 4 kB (brotli) for the whole universal API, and tree-shakable.
- **Typed.** `createEnv()` turns raw strings into `number`, `boolean`, unions and lists,
  with types inferred from the schema.
- **Secure by default.** It is safe against prototype pollution, parses in linear time
  with size limits, never puts values in error messages, redacts secrets in logs and
  JSON, and throws if a secret is read in a browser or app bundle.
- **One parser everywhere.** The `.env` parser has no Node dependency, and file loading
  is a separate `dotvar/node` entry, so client bundles never pull in `fs`.

```bash
npm install dotvar      # or: yarn add dotvar / pnpm add dotvar / bun add dotvar
```

Also published to GitHub Packages as `@xkid1/dotvar`.

## Quick start (Node, Bun, Deno, Electron main)

```dotenv
# .env
PORT=8080
DB_PASSWORD='s3cr3t'          # single quotes: literal, never expanded
DATABASE_URL="postgres://app:${DB_PASSWORD}@localhost:5432/app"
FEATURES=search, export
```

```ts
import { createEnv, list, load, port, string, url } from 'dotvar/node';

load({ expand: true }); // .env → process.env (existing variables always win)

export const env = createEnv({
  schema: {
    PORT: port({ default: 3000 }),
    DATABASE_URL: url({ protocols: ['postgres:'], secret: true }),
    FEATURES: list({ default: [] }),
    LOG_LEVEL: string({ optional: true }),
  },
});

env.PORT; //         number
env.FEATURES; //     readonly string[]
env.LOG_LEVEL; //    string | undefined
console.log(env); // { PORT: 8080, DATABASE_URL: '[REDACTED]', … }
```

If anything is missing or invalid, `createEnv` throws **one** error that lists every problem:

```text
EnvValidationError: Invalid environment variables:
  - PORT: must be a port number between 1 and 65535
  - DATABASE_URL: is required but missing
```

Prefer a one-liner? `import 'dotvar/config'` or `node --import dotvar/config app.js` loads
the `.env` files before your code runs.

## Entry points

| Import          | Runs in                                | Contains                                          |
| --------------- | -------------------------------------- | ------------------------------------------------- |
| `dotvar`        | everywhere (browsers, RN, workers, …)  | `createEnv`, validators, `parse`, errors          |
| `dotvar/node`   | Node ≥ 20.19, Bun, Deno, Electron main | everything above, plus `load()` for `.env` files |
| `dotvar/config` | same as `dotvar/node`                  | side effect: `load()` with defaults               |

The package is ESM-only. CommonJS can still `require('dotvar')` on Node ≥ 20.19 / 22.12
(`require(esm)`).

## Validators

Every validator accepts `default`, `optional`, `secret` and `description`. A variable with
a `default` is never `undefined`. One with `optional: true` (and no default) is
`T | undefined`.

| Validator                | Type                | Accepts                                                                 |
| ------------------------ | ------------------- | ----------------------------------------------------------------------- |
| `string()`               | `string`            | anything; options `minLength`, `maxLength`, `pattern`                   |
| `number()`               | `number`            | plain decimals (`-1`, `2.5`, `1e3`), not hex, `Infinity` or `''`; `min`, `max`, `integer` |
| `integer()`              | `number`            | safe integers; `min`, `max`                                             |
| `port()`                 | `number`            | `1`–`65535`                                                             |
| `boolean()`              | `boolean`           | `true/false`, `1/0`, `yes/no`, `on/off` (case-insensitive)              |
| `url()`                  | `string`            | absolute URLs; `protocols: ['https:']`                                  |
| `email()`                | `string`            | `local@domain.tld`                                                      |
| `oneOf(['a', 'b'])`      | `'a' \| 'b'`        | one of the listed strings                                               |
| `list()`                 | `readonly string[]` | comma-separated (`separator`, `minItems`), trimmed, empty items dropped |
| `json<T>()`              | `T`                 | JSON, with `__proto__` keys stripped                                    |
| `makeSpec(kind, parse)`  | yours               | build a custom validator                                                |

```ts
import { makeSpec } from 'dotvar';

const hex = makeSpec('hex', (raw) =>
  /^[0-9a-f]+$/i.test(raw) ? { ok: true, value: raw.toLowerCase() } : { ok: false, message: 'must be hex' },
);
```

### `createEnv(options)`

| Option                 | Default               | Description                                                                 |
| ---------------------- | --------------------- | --------------------------------------------------------------------------- |
| `schema`               | required              | variable name → validator                                                   |
| `source`               | `process.env` if any  | any `Record<string, string \| undefined>`, such as `import.meta.env` or `parse()` output |
| `prefix`               | `''`                  | read `VITE_API_URL` for the schema key `API_URL`                            |
| `emptyAsUndefined`     | `true`                | `KEY=` counts as missing, so a required variable fails loudly              |
| `allowSecretsOnClient` | `false`               | let `secret: true` variables be read in a browser / React Native            |

The result is frozen. `JSON.stringify`, `String()`, `console.log` and `util.inspect`
show `[REDACTED]` for secrets. Property access (`env.API_KEY`) returns the real value.

## Frameworks

Bundlers only inline variables they can see **literally** at build time, and anything
inlined is public. So in client code you pass the build-time object as `source` and
never mark client values as `secret`. dotvar throws if you do.

### Vite (React, Vue, Svelte, SolidJS, Astro, SvelteKit client)

```ts
// src/env.ts
import { createEnv, oneOf, url } from 'dotvar';

export const env = createEnv({
  source: import.meta.env,
  prefix: 'VITE_',
  schema: {
    API_URL: url(),
    MODE: oneOf(['development', 'production']),
  },
});
```

### Next.js

In server code use `dotvar/node` (Next already loads `.env*`, so just call
`createEnv`). Client values must be referenced literally:

```ts
export const clientEnv = createEnv({
  source: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL },
  prefix: 'NEXT_PUBLIC_',
  schema: { API_URL: url() },
});
```

### Create React App / webpack

`source: process.env` with `prefix: 'REACT_APP_'` (CRA
defines the whole object). With a custom `DefinePlugin`, list the variables as in Next.js.

### Angular

Validate whatever your build injects (`environment.ts`, `define` in
`angular.json`, or `@ngx-env/builder`'s `import.meta.env`):

```ts
import { environment } from './environments/environment';
export const env = createEnv({ source: environment, schema: { apiUrl: url() } });
```

### React Native / Expo

Expo inlines `process.env.EXPO_PUBLIC_*` only when it is written
out literally:

```ts
export const env = createEnv({
  source: { EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL },
  prefix: 'EXPO_PUBLIC_',
  schema: { API_URL: url() },
});
// react-native-config: createEnv({ source: Config, schema })
```

`url()` checks URLs without the `URL` getters that React Native doesn't implement.

### Electron

The **main** process is Node, so use `dotvar/node` there and keep secrets
in main. In the **renderer**, expose only the public values from the preload script with
`contextBridge` and validate them with `dotvar`.

## `.env` syntax

```dotenv
# full-line comment
PLAIN=value                    # inline comment after whitespace
export EXPORTED=works          # `export` prefix is allowed
URL=https://example.com/#top   # '#' inside a word is kept
EQUALS=a=b=c                   # only the first '=' separates
EMPTY=
DOUBLE="line1\nline2 \"quoted\" \$literal"   # escapes: \n \r \t \" \\ \$
SINGLE='literal ${NOT_EXPANDED} \n'           # no escapes, no expansion
MULTILINE="-----BEGIN KEY-----
...
-----END KEY-----"
REF=${PLAIN}/x                 # with expand: true (earlier lines and the env only)
FALLBACK=${MISSING:-default}   # ':-' also covers empty values, '-' only unset ones
```

- Keys: `[A-Za-z_][A-Za-z0-9_.-]*`. `__proto__`, `constructor` and `prototype` are rejected.
- CRLF line endings and a UTF-8 BOM are handled. The last duplicate key wins.
- Expansion is **off by default** and supports only `${NAME}`, so a bare `$` (common in
  passwords) is never touched. There is no command substitution.
- `parse(text, { expand, env, maxLength })` works in any runtime and returns a frozen,
  prototype-free object.

## Loading files: `load(options)` (from `dotvar/node`)

Without `path`, `load()` reads this cascade (later files win, missing files are skipped):
`.env` → `.env.local` → `.env.<mode>` → `.env.<mode>.local`. `.env.local` is skipped
when the mode is `test`.

| Option     | Default            | Description                                                                 |
| ---------- | ------------------ | --------------------------------------------------------------------------- |
| `path`     | the cascade        | file or list of files (relative to `cwd` or absolute); later ones win       |
| `cwd`      | `process.cwd()`    | base directory                                                              |
| `mode`     | `NODE_ENV`         | must match `[A-Za-z0-9_-]+`, so it can't be used for path traversal         |
| `override` | `false`            | overwrite variables that already exist                                     |
| `expand`   | `false`            | `${NAME}` resolves to the value the variable will actually have after loading |
| `target`   | `process.env`      | where values are written; `null` only returns them                          |
| `required` | `false`            | throw when nothing (or a listed `path`) is missing                          |
| `maxBytes` | `1048576`          | per-file size limit                                                         |

It returns `{ parsed, files, warnings }`. `warnings` flags, for example, a world-writable
`.env` file.

## Errors

All errors extend `DotvarError` and carry a stable `code`. Messages **never** contain
values, so they are safe to log or send to an error tracker.

| Code                          | Thrown by                    | Meaning                                                |
| ----------------------------- | ---------------------------- | ------------------------------------------------------ |
| `ERR_DOTVAR_PARSE`            | `parse`, `load`              | malformed `.env` (`EnvParseError` has `line`, `file`)  |
| `ERR_DOTVAR_LIMIT`            | `parse`, `load`              | input or expansion exceeds a size limit                |
| `ERR_DOTVAR_VALIDATION`       | `createEnv`                  | `EnvValidationError` with `issues: { key, message }[]` |
| `ERR_DOTVAR_SECRET_ON_CLIENT` | `createEnv`                  | a `secret` variable read in a browser / React Native   |
| `ERR_DOTVAR_FILE`             | `load`                       | a file can't be read safely, or a required one is missing |
| `ERR_DOTVAR_OPTION`           | everything                   | invalid option                                         |

## Security

What dotvar guarantees, and how each guarantee is tested, is documented in
[SECURITY.md](SECURITY.md). Please report vulnerabilities privately as described there.

## Migrating from 1.x

- `require('dotvar').read()` → `import { load } from 'dotvar/node'; load();`
  (`read()` still exists, deprecated).
- The package is now ESM-only and needs Node ≥ 20.19.
- Values containing `=` and quotes inside values are now kept intact, and comments
  follow shell rules.

## License

[MIT](LICENSE)
