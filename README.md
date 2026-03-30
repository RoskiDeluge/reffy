# reffy

[![npm version](https://img.shields.io/npm/v/reffy-cli.svg)](https://www.npmjs.com/package/reffy-cli)
[![MIT License](https://img.shields.io/github/license/RoskiDeluge/reffy-ts.svg)](LICENSE)
[![CI](https://github.com/RoskiDeluge/reffy-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/RoskiDeluge/reffy-ts/actions/workflows/ci.yml)

Reffy is a CLI-first planning system for agent-friendly development workflows. It keeps ideation artifacts in straightforward version-controlled markdown files and manages formal planning files under `.reffy/reffyspec/`.

## Install

```bash
npm install -g reffy-cli@latest
```

## Quickstart (CLI-only)

Inside your project:

```bash
cd your-project
reffy init
```

Command summary:

- `reffy init`: runs the canonical first-run setup flow, creates the `.reffy/` and `.reffy/reffyspec/` structure, writes managed instructions, reindexes artifacts, and on first-run text output prints a copy/paste instruction for your agent harness.
- `reffy bootstrap`: compatibility alias for `reffy init`.
- `reffy migrate`: migrates a legacy `.references/` workspace into `.reffy/`.
- `reffy doctor`: diagnoses required Reffy setup and workspace health.
- `reffy reindex`: reconciles `.reffy/manifest.json` with `.reffy/artifacts` by adding missing files and removing stale entries.
- `reffy validate`: validates `.reffy/manifest.json` against manifest v1 contract.
- `reffy summarize`: generates a read-only handoff summary from indexed artifacts.
- `reffy plan create`: generates proposal, task, design, and spec scaffolds from indexed Reffy artifacts.
- `reffy plan validate|list|show|archive`: manages the planning lifecycle under `.reffy/reffyspec/`.
- `reffy spec list|show`: inspects current spec state under `.reffy/reffyspec/`.
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
reffy diagram render --input .reffy/reffyspec/specs/auth/spec.md --format ascii
reffy diagram render --input .reffy/reffyspec/specs/auth/spec.md --format svg --output .reffy/artifacts/auth-spec.svg
```

## Using Reffy With ReffySpec

A practical pattern is:

1. Use Reffy for ideation and context capture in `.reffy/artifacts/`.
2. Use Reffy to scaffold and manage planning files in `.reffy/reffyspec/`.
3. Keep a clear traceable path from exploratory artifacts to formal specs.
4. Use Reffy commands for day-to-day workflow.

Reference implementation in this repo:

- `AGENTS.md`: contains both managed instruction blocks and encodes sequencing.
- `AGENTS.md`: Reffy block routes ideation/exploration requests to `@/.reffy/AGENTS.md`.
- `AGENTS.md`: ReffySpec block routes planning/proposal/spec requests to `@/.reffy/reffyspec/AGENTS.md`.
- `.reffy/AGENTS.md`: defines the artifact and ideation workflow.
- `.reffy/reffyspec/AGENTS.md`: defines the ReffySpec planning/spec workflow conventions used in this repo.
- `.reffy/reffyspec/project.md`: captures durable project context for agents, including purpose, stack, architecture, conventions, and constraints.

## Develop

For local development of this repo:

```bash
npm install
npm run build
npm run check
npm test
```

`npm install` runs this package's `prepare` step, which builds `dist/` automatically.

## Release Security

Reffy publishes from GitHub Actions using npm trusted publishing with provenance enabled.

To verify an installed package:

- Check the package provenance details on npm.
- Run `npm audit signatures` after install to verify registry signatures and available provenance attestations.
