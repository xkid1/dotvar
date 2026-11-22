# Contributing

Thanks for helping! By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
See [ACCESSIBILITY.md](ACCESSIBILITY.md) for how docs and messages stay accessible.

The ground rules:

1. **Zero runtime dependencies.** `dependencies` and `peerDependencies` stay empty.
2. **Universal by default.** Code outside `src/libs/node` must run in browsers, React
   Native and workers: no `node:*`, `process`, `Buffer` or DOM types. ESLint and
   `yarn verify:dist` enforce this.
3. **Security defaults never get weaker.** A new option may add strictness or be an
   explicit opt-in. Every security check needs a negative test.
4. **Errors never contain values.** Throw `DotvarError` subclasses with a stable code.

## Setup

```bash
corepack enable
yarn install
yarn check   # typecheck + lint + format:check + tests
yarn e2e     # build, pack, install offline into a fresh app, run consumer tests
```

## Layout

```text
src/
├── index.ts          universal entry (dotvar)
├── node.ts           dotvar/node
├── config.ts         dotvar/config (side effect)
├── libs/             parser, expand, schema (createEnv + validators), errors, node (fs loader)
├── utils/            helpers, runtime detection, security primitives
└── types/            shared types only
```

Dependency direction is `libs → utils → types`. Import other layers through their
aliases (`@libs`, `@utils`, `@types`) and use relative paths within a layer. Tests sit
next to the code (`*.test.ts`).

## Pull requests

- Use Conventional Commit titles, e.g. `fix(parser): keep '#' inside unquoted URLs`.
- Add an entry under **Unreleased** in `CHANGELOG.md`.
- Public API changes update `README.md`, `src/index.test.ts` and `e2e/consumer/`.
