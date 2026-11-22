# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## Unreleased

## 2.0.0

A rewrite: typed, validated environment variables for every JavaScript runtime.

### Added

- `createEnv()` with type inference and validators: `string`, `number`, `integer`, `port`,
  `boolean`, `url`, `email`, `oneOf`, `list`, `json`, and `makeSpec` for custom ones.
- Universal `parse()`: `export`, inline comments, single/double/backtick quotes,
  multi-line values, escapes, CRLF/BOM handling and opt-in `${VAR}` / `${VAR:-default}`
  expansion.
- `dotvar/node` with `load()`: the `.env` → `.env.local` → `.env.<mode>` →
  `.env.<mode>.local` cascade, `override`, `target`, `required`, `maxBytes`.
- `dotvar/config` side-effect entry (`import 'dotvar/config'`, `node --import dotvar/config`).
- Secret redaction in `JSON.stringify`, `String()` and `util.inspect`. A
  `ERR_DOTVAR_SECRET_ON_CLIENT` guard in browsers and React Native.
- Typed errors with stable codes; messages never contain values.
- Published to npm (`dotvar`) and GitHub Packages (`@xkid1/dotvar`).

### Security

- Rejects `__proto__` / `constructor` / `prototype` keys; parse results have no prototype.
- Linear-time parser with input size limits and a cap on expansion output.
- File reads open once and `fstat` the descriptor (no TOCTOU), reject non-regular files
  without blocking on FIFOs, enforce a byte limit, and restrict `mode` / `NODE_ENV` to a
  safe alphabet (no path traversal).

### Changed (breaking)

- ESM-only; Node ≥ 20.19 (CommonJS works through `require(esm)`).
- `read()` moved to `dotvar/node` and is deprecated in favour of `load()`.
- Values containing `=` and quote characters are kept intact (1.x truncated or stripped them).
- Nothing is logged to the console any more; errors are thrown instead.

## 1.0.1

- Initial release: `read()` loads `.env` into `process.env`.
