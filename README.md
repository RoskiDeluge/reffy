# reffy

[![npm version](https://img.shields.io/npm/v/reffy-cli.svg)](https://www.npmjs.com/package/reffy-cli)
[![MIT License](https://img.shields.io/github/license/RoskiDeluge/reffy-ts.svg)](LICENSE)
[![CI](https://github.com/RoskiDeluge/reffy-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/RoskiDeluge/reffy-ts/actions/workflows/ci.yml)

Reffy is a CLI-first planning/runtime system for agent-friendly development workflows. It keeps ideation artifacts in straightforward version-controlled markdown files and uses `reffyspec/` as the canonical planning/spec layout.

## Install

```bash
npm install -g reffy-cli@latest
```

## Quickstart (CLI-only)

Inside your project:

```bash
reffy init
reffy bootstrap
```

Command summary:

- `reffy init`: idempotently creates/updates root `AGENTS.md` managed block and `.reffy/AGENTS.md`.
- `reffy bootstrap`: idempotently runs `init`, ensures `.reffy/` structure exists, then reindexes artifacts.
- `reffy migrate`: migrates a legacy `.references/` workspace into the canonical `.reffy/` layout.
- `reffy doctor`: diagnoses required Reffy setup and workspace health.
- `reffy reindex`: reconciles `.reffy/manifest.json` with `.reffy/artifacts` by adding missing files and removing stale entries.
- `reffy validate`: validates `.reffy/manifest.json` against manifest v1 contract.
- `reffy summarize`: generates a read-only handoff summary from indexed artifacts.
- `reffy plan create`: generates proposal/tasks/spec scaffolds into the canonical `reffyspec/` layout from indexed Reffy artifacts.
- `reffy plan validate|list|show|archive`: runs the planning lifecycle natively inside Reffy against `reffyspec/`.
- `reffy spec list|show`: inspects current spec state natively from `reffyspec/`.
- `reffy diagram render`: renders Mermaid diagrams as SVG or ASCII, including spec-aware generation from compatible `spec.md` files.

Output modes:

- `--output text` (default)
- `--output json`
- `--json` (shortcut for `--output json`)

Examples:

```bash
reffy reindex --output json
reffy validate --repo .
reffy doctor --output text
reffy doctor --output json
reffy summarize --output text
reffy summarize --output json
reffy plan create --change-id add-login-flow --artifacts login-idea.md
reffy plan list --output json
reffy plan archive add-login-flow
reffy spec show auth --output json
reffy diagram render --stdin --format svg < diagram.mmd
reffy diagram render --input reffyspec/specs/auth/spec.md --format ascii
reffy diagram render --input reffyspec/specs/auth/spec.md --format svg --output .reffy/artifacts/auth-spec.svg
```

## Runtime Position

Reffy is the planning/runtime authority in this repository. `reffyspec/` is the native planning/spec surface that matches that runtime ownership.

That means:

1. Reffy owns ideation artifacts, planning scaffolds, inspection, validation, and archive lifecycle behavior.
2. The vendored fork at `.vendor/ReffySpec` is reference-only.
3. `reffyspec/` is canonical for active changes, archived changes, and current specs.
4. No external planning CLI is part of the normal workflow.

## Using Reffy With ReffySpec

A practical pattern is:

1. Use Reffy for ideation and context capture in `.reffy/`.
2. Use Reffy to scaffold and manage planning files in `reffyspec/`.
3. Keep a clear traceable path from exploratory artifacts to formal specs.
4. Use Reffy commands for day-to-day workflow.

Reference implementation in this repo:

- `AGENTS.md`: contains both managed instruction blocks and encodes sequencing.
- `AGENTS.md`: Reffy block routes ideation/exploration requests to `@/.reffy/AGENTS.md`.
- `AGENTS.md`: ReffySpec block routes planning/proposal/spec requests to `@/reffyspec/AGENTS.md`.
- `.reffy/AGENTS.md`: defines Reffy as the primary runtime and documents compatibility expectations.
- `reffyspec/AGENTS.md`: defines the ReffySpec planning/spec workflow conventions used in this repo.
- `src/cli.ts`: `reffy init`/`reffy bootstrap` enforce this integration by idempotently writing the managed guidance into `AGENTS.md`, `.reffy/AGENTS.md`, and `reffyspec/AGENTS.md`.

Practical connection pattern for any repo:

1. Run `reffy init` to install/refresh the Reffy instruction layer.
2. Keep ReffySpec instructions in the same root `AGENTS.md`.
3. During planning, cite only relevant Reffy artifacts from `.reffy/artifacts/` in your proposal/spec docs.
4. Prefer Reffy commands for day-to-day workflow.

## Current Boundary

The current project boundary is:

- Native Reffy ownership:
  - `reffy plan create`
  - `reffy plan validate`
  - `reffy plan list`
  - `reffy plan show`
  - `reffy plan archive`
  - `reffy spec list`
  - `reffy spec show`
- Native ReffySpec surface:
  - the on-disk `reffyspec/changes/` and `reffyspec/specs/` layout
  - `reffyspec/AGENTS.md` as the planning/spec conventions file
- Unresolved runtime gaps:
  - none identified for the normal local planning lifecycle in v1

That means the normal workflow is fully Reffy and ReffySpec native.

## Develop

For local development of this repo:

```bash
npm install
npm run build
npm run check
npm test
```

`npm install` runs this package's `prepare` step, which builds `dist/` automatically.
