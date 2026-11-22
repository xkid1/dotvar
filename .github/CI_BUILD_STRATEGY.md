# CI, release and repository automation

How the GitHub Actions workflows for `dotvar` fit together, what each check
runs, and the one-time repository settings they rely on.

## Principles

- **Zero runtime dependencies.** `package.json` has no `dependencies` or
  `peerDependencies`, and `yarn verify:dist` fails the build if a bare import appears in
  `dist/`. The e2e suite installs the packed tarball with `npm install --offline`, which
  only succeeds when nothing else has to be fetched.
- **Security defaults are tested, not trusted.** Every security check (forbidden keys,
  size limits, expansion caps, secret redaction, the client-runtime guard, safe file
  reads) has a negative test, and coverage thresholds keep them from silently
  disappearing.
- **Test what users install.** `yarn e2e` packs the package as it is published and uses it
  from a fresh consumer project through the `exports` map only. The release publishes the
  tarball that `verify:dist` checked.
- **Same commands locally and in CI.** Every check is a `yarn` script, so `yarn check` and
  `yarn e2e` reproduce CI on your machine.
- **Least privilege.** Workflows default to `contents: read`. Jobs request write scopes
  only where they need them, and `pull_request_target` workflows never check out PR code.

## Shared building blocks

| Action                    | What it does                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.github/actions/setup`   | Node from `.nvmrc` (or the `node-version` input), Yarn 4 through Corepack, a Yarn cache keyed on `yarn.lock`, `yarn install --immutable`                                                         |
| `.github/actions/changes` | Outputs `code=false` when a PR or push only changes docs/config (`*.md`, `*.yml` outside `.github/`, `docs/`), so expensive jobs skip themselves. Workflow and action edits always count as code |

Skipped jobs count as passed for required status checks, so docs-only PRs can still merge.

## Build output

`yarn build` runs `clean → swc (JS) → tsc (d.ts) → scripts/rewrite-aliases.mjs` and
produces pure ESM (ES2020) in `dist/` for the three entry points `.`, `./node` and
`./config`. Source imports use the `@libs`/`@utils`/`@types` aliases; the rewrite script
turns them into relative `.js` paths in both JS and `.d.ts`. `yarn verify:dist` then
asserts that no alias is left, there are no bare imports, every relative import resolves,
the universal entry never reaches a `node:` module, public types don't reference Node
typings, and every entry point loads in Node.

## Pull request checks

Every pull request, and every push to `main`, runs these. Each job has a short, stable
name so it can be marked as a required check:

| Workflow                | Check name          | Runs                                                                                               | Required    |
| ----------------------- | ------------------- | -------------------------------------------------------------------------------------------------- | ----------- |
| `ci.yml`                | `Lint`              | `yarn lint` (type-aware, security, import-x layering)                                              | yes         |
| `ci.yml`                | `Typecheck`         | `yarn typecheck`                                                                                   | yes         |
| `ci.yml`                | `Format`            | `yarn format:check`                                                                                | optional    |
| `test.yml`              | `Test`              | `yarn test:coverage` (95% lines/functions/statements, 90% branches); summary in the job summary    | yes         |
| `build.yml`             | `Build`             | `yarn build` + `yarn verify:dist`; uploads `dist/` as an artifact                                  | yes         |
| `bench.yml`             | `Size`              | `bench/size.mjs --check`: brotli budgets from `bench/size-budget.json`                             | yes         |
| `e2e.yml`               | `E2E`               | `yarn e2e` on Node 20, 22, 24 and 26 (one summary check over the matrix)                           | yes         |
| `codeql.yml`            | `Analyze (…)`       | CodeQL for TypeScript/JavaScript and for the workflows themselves                                  | recommended |
| `dependency-review.yml` | `Dependency review` | Fails when a PR adds a dependency version with a known moderate+ vulnerability                     | yes         |
| `pr-title.yml`          | `PR title`          | Conventional Commits title (it becomes the release-notes entry)                                    | optional    |

On `main` and on demand, `bench.yml` also runs **Runtimes**: `bench/runtimes.mjs` against
the built package in Node, Bun, Deno and Chromium/Firefox/WebKit (informational only, as
shared runners are noisy).

### End-user suite (`e2e.yml`)

`yarn e2e` (`e2e/run.mjs`):

1. builds and `yarn pack`s only what `files` publishes
2. installs the tarball into a fresh consumer app with `npm install --offline`
3. runs `e2e/consumer/*.test.{mjs,cjs}` with `node --test`: package surface, CommonJS
   `require(esm)`, `dotvar/config` and `node --import dotvar/config`, simulated browser and
   React Native runtimes
4. type-checks a TypeScript consumer with NodeNext and Bundler resolution, without
   `@types/node`
5. bundles the universal entry for the browser with Vite, checks it has no Node built-ins
   and runs the bundle with browser-like globals

It runs on every Node version that `engines` allows. The `E2E` job is the single check to
mark as required.

## Release (`publish.yml`)

Releasing is fully automated from a version tag:

1. Move the CHANGELOG's **Unreleased** entries under a `## X.Y.Z` heading (`## [X.Y.Z]`
   and a date suffix also work) and set `version` in `package.json` to `X.Y.Z`. Merge to
   `main`.
2. Push the tag: `git tag vX.Y.Z && git push origin vX.Y.Z`. The workflow creates the
   GitHub Release itself, so don't create it by hand.
3. The workflow then runs:
   - **verify**: the tag matches `package.json`, the CHANGELOG has the version,
     `yarn check`, `yarn build` and `yarn verify:dist` pass, then `yarn pack`
   - **e2e**: the end-user suite (`e2e.yml`) on the tag
   - **publish**: the verified tarball to npmjs.com as `dotvar` (with provenance) and,
     re-scoped as `@xkid1/dotvar`, to GitHub Packages (it only accepts names scoped to
     the repository owner), then the GitHub Release with generated notes grouped by PR label
     (`.github/release.yml`)

A version with a hyphen (`1.2.0-beta.1`) is published under the `next` dist-tag and marked
as a pre-release. Every publish step is skipped when that version already exists, so
re-running the workflow, or dispatching it manually with the tag, safely finishes a
release that failed halfway.

**npm authentication**, in order of preference:

1. **Trusted publishing (OIDC)**: no secret needed. Configure it on npmjs.com under the
   package's **Settings → Trusted publisher** (GitHub Actions, `xkid1/dotvar`,
   `publish.yml`).
2. **`NPM_TOKEN` secret**: a granular token with publish rights. Needed for the very first
   publish, because trusted publishing can only be configured once the package exists.

GitHub Packages uses the workflow's `GITHUB_TOKEN`.

## Repository automation

| Workflow                    | Trigger             | What it does                                                                                                                                                                          |
| --------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-labeler.yml`            | PR opened/updated   | Labels PRs from the files they change (`labeler.yml`): `parser`, `schema`, `node`, `security`, `types`, `utils`, `source`, `tests`, `e2e`, `benchmarks`, `ci`, `documentation`, `tooling` |
| `pr-title.yml`              | PR opened/edited    | Enforces Conventional Commits titles                                                                                                                                                  |
| `pr-welcome.yml`            | First issue or PR   | Welcomes first-time contributors and points them to the guidelines                                                                                                                    |
| `dependabot-auto-merge.yml` | Dependabot PRs      | Auto-merges minor/patch devDependency and GitHub Actions updates once all required checks pass                                                                                        |
| `stale.yml`                 | Daily               | Marks issues/PRs stale after 60 days without activity and closes them 14 days later (`bug`, `security`, `interop` and `accessibility` issues are exempt)                                               |
| `codeql.yml`                | PRs, `main`, weekly | CodeQL security and quality analysis                                                                                                                                                  |
| `scorecard.yml`             | `main`, weekly      | OpenSSF Scorecard for supply-chain practices                                                                                                                                          |

**Dependabot** (`dependabot.yml`) proposes npm and GitHub Actions updates weekly, grouped
(minor/patch together, majors separately), and waits 5 days after a release before
proposing it. Every npm package here is a devDependency, so these PRs never change what
users install.

## One-time repository settings

These can't be set from workflow files. A repository admin sets them once:

1. **Branch ruleset for `main`**: **Settings → Rules → Rulesets → New branch ruleset**.
   Target the default branch, set **Enforcement status** to **Active**, and enable:
   - **Require a pull request before merging**
   - **Require status checks to pass**, adding `Lint`, `Typecheck`, `Test`, `Build`,
     `Size`, `E2E` and `Dependency review` (optionally `Format`, `PR title` and the CodeQL
     checks). A check can only be selected after it has run once, so open a PR first.
   - Optionally **Require branches to be up to date before merging**
2. **Settings → General → Allow auto-merge**, for Dependabot auto-merge.
3. **Settings → Code security**: turn on **Private vulnerability reporting** (used by
   `SECURITY.md`), Dependabot alerts and the dependency graph.
4. **Labels**: create the labels `labeler.yml` applies, plus `security`, `interop`, `accessibility` and
   `skip-changelog` (the labeler doesn't create missing labels on every repository setup).
5. **npm**: create the `NPM_TOKEN` secret for the first release, then configure trusted
   publishing and delete the token.

## Local validation

```bash
yarn check          # typecheck + lint + format:check + test
yarn test:coverage  # tests with the coverage thresholds
yarn build && yarn verify:dist
yarn bench:size --check
yarn e2e            # the packed-tarball end-user suite
```
