# Pull Request

<!--
Thanks for contributing! Please read Contributing.md and CLAUDE.md first.
The PR title must follow Conventional Commits, e.g. `fix(parser): keep '#' inside unquoted URLs`.
Security vulnerabilities go in a private advisory (SECURITY.md), not a public PR.
-->

## Summary

<!-- What changed and why. Link the issue it fixes, e.g. "Fixes #123". -->

## Change type

- [ ] Bug fix
- [ ] Feature or behavior change
- [ ] Security hardening (stricter check or new opt-in)
- [ ] Breaking change (removed/renamed export, changed `DotvarErrorCode`, changed parse result, or a stricter default)
- [ ] Refactor or maintenance
- [ ] Documentation

## Verification

CI runs typecheck, lint, format, tests with coverage, `build` + `verify:dist`, the size
budgets and `yarn e2e` (the packed package installed offline in a fresh project, on Node
20–26). All must pass.

- [ ] `yarn check` passes locally
- [ ] `yarn e2e` passes locally (for packaging, entry-point or public API changes)
- [ ] Tests added or updated for every behavior change
- [ ] Every new security check has a negative test

## Review checklist

- [ ] No runtime dependency added (`dependencies` / `peerDependencies` stay empty)
- [ ] Universal code is runtime-agnostic: `node:*`, `process`, `Buffer` only in `src/libs/node`
- [ ] No security default weakened (forbidden keys, size limits, secret redaction, client guard, safe mode names)
- [ ] Errors are `DotvarError` subclasses with a stable code; messages never contain values
- [ ] Layering respected (`libs → utils → types`); new types live in `src/types`
- [ ] Public API changes update the `src/index.ts` / `src/node.ts` exports, `src/index.test.ts`, `README.md` and `e2e/consumer/`
- [ ] `CHANGELOG.md` has an entry under **Unreleased**
- [ ] Bundle-size budget changes (`bench/size-budget.json`) are explained
