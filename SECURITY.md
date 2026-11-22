# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through
[GitHub private vulnerability reporting](https://github.com/xkid1/dotvar/security/advisories/new).
Include a minimal reproduction with placeholder values (never real secrets). You will get
an answer within a few days. Fixes are released as patch versions and credited in the
advisory unless you prefer otherwise.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 2.x     | yes       |
| 1.x     | no        |

## Threat model and guarantees

dotvar handles configuration that often contains credentials. It aims to make the safe
path the default one. Each guarantee below has a negative test.

| Guarantee                                                                                              | Where                             |
| ------------------------------------------------------------------------------------------------------ | --------------------------------- |
| No prototype pollution: `__proto__`, `constructor` and `prototype` keys are rejected, parse results have no prototype, `json()` strips `__proto__` | `src/utils/security`, parser, `json()` |
| No ReDoS: the parser and number check are single-pass scanners; the remaining regexes have no nested quantifiers | `src/libs/parser`, validators     |
| Bounded resources: input size limit (default 1 MiB) and a cap on `${VAR}` expansion output (no "billion laughs") | parser                            |
| Values never appear in error messages, only variable names, line numbers and file paths               | `src/libs/errors`                 |
| Secrets are redacted from `JSON.stringify`, `String()` and `util.inspect` / `console.log`              | `createEnv`                       |
| Reading a `secret` in a browser or React Native throws (bundled values are public)                     | `createEnv`, `src/utils/runtime`  |
| `NODE_ENV` / `mode` cannot cause path traversal (`[A-Za-z0-9_-]` only)                                  | `src/libs/node`                   |
| Files are opened once and checked with `fstat` on the descriptor (no TOCTOU), must be regular files (FIFOs can't block startup), and are size-limited; world-writable files produce a warning | `src/libs/node/file.ts`           |
| Expansion is opt-in, braced-only (`${NAME}`), with no command substitution; single quotes are literal   | parser                            |
| Existing environment variables win over files unless `override: true`                                  | `load()`                          |
| Zero runtime dependencies, so no transitive supply-chain risk. Releases are published with npm provenance | `scripts/verify-dist.mjs`, CI     |

## Out of scope

- Protecting values once your code has read them (`env.API_KEY` returns the real value).
- Secrets placed in client bundles with `allowSecretsOnClient: true`: anything shipped to
  a browser or app is readable by its users.
- Keeping `.env` files out of version control. Add them to `.gitignore` and commit an
  `.env.example` instead.
