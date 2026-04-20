# reffy

[![npm version](https://img.shields.io/npm/v/reffy-cli.svg)](https://www.npmjs.com/package/reffy-cli)
[![MIT License](https://img.shields.io/github/license/RoskiDeluge/reffy-ts.svg)](LICENSE)
[![CI](https://github.com/RoskiDeluge/reffy-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/RoskiDeluge/reffy-ts/actions/workflows/ci.yml)

Reffy is a planning system for AI assisted development. It keeps ideation artifacts in straightforward version-controlled markdown files and manages formal planning files under `.reffy/reffyspec/`.

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
- `reffy remote init|status|push|ls|cat`: links, publishes, and inspects a Paseo-backed remote `.reffy/` workspace.
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
reffy remote init --endpoint https://your-paseo-endpoint.example --provision
reffy remote status --output json
reffy remote push
reffy remote ls
reffy remote cat .reffy/manifest.json
reffy diagram render --stdin --format svg < diagram.mmd
reffy diagram render --input .reffy/reffyspec/specs/auth/spec.md --format ascii
reffy diagram render --input .reffy/reffyspec/specs/auth/spec.md --format svg --output .reffy/artifacts/auth-spec.svg
```

## Remote Backend Helper

Reffy includes a Paseo helper bridge at `scripts/reffy-remote-backend-demo.mjs`.

The helper:

- loads `.env` automatically when present
- reads `project_id` and `workspace_name` from `.reffy/manifest.json`
- provisions or links a Paseo `reffyRemoteBackend` actor
- imports the local `.reffy/` workspace

Expected environment variables:

- `PASEO_ENDPOINT` - required unless already exported in the shell
- `PASEO_POD_NAME` - optional existing pod override
- `PASEO_ACTOR_ID` - optional existing actor override

Examples:

```bash
npm run remote:backend:demo
reffy remote init --provision
reffy remote push
```

## Remote Sync

Reffy can publish the local `.reffy/` workspace to a Paseo-backed remote actor and inspect it later with native CLI commands.

The current remote flow is:

1. Reffy reads `project_id` and `workspace_name` from `.reffy/manifest.json`.
2. Reffy connects to Paseo using `PASEO_ENDPOINT` or `--endpoint`.
3. `reffy remote init --provision` creates a pod and actor when needed, then writes local linkage state to `.reffy/state/remote.json`.
4. `reffy remote push` publishes the local workspace to that linked actor.
5. `reffy remote status|ls|cat` inspects the linked remote workspace.

### Minimal connection requirement

For the fresh-provision path, the only required connection value is:

- `PASEO_ENDPOINT`

Example `.env`:

```bash
PASEO_ENDPOINT="https://your-paseo-endpoint.example"
```

That is enough for:

```bash
reffy remote init --provision
```

Optional overrides:

- `PASEO_POD_NAME` if you want to reuse an existing Paseo pod
- `PASEO_ACTOR_ID` if you want to reuse an existing backend actor

Reffy does not require separate `REFFY_PROJECT_ID` or `REFFY_WORKSPACE_NAME` values for the normal case because those come from `.reffy/manifest.json`.

### Saved remote linkage

After `reffy remote init`, Reffy stores the local pointer to the linked backend actor in:

- `.reffy/state/remote.json`

That file contains the connection tuple Reffy uses to reach the backend:

- `endpoint`
- `pod_name`
- `actor_id`

This file is local runtime state. It is not part of the synced remote workspace and is intentionally excluded from `reffy remote push`.

### Example flow

```bash
reffy init
reffy remote init --provision
reffy remote status
reffy remote push
reffy remote ls
reffy remote cat .reffy/manifest.json
```

## Manifest Contract

Reffy keeps workspace metadata in `.reffy/manifest.json`. New managed manifests include both core timestamps and workspace identity:

```json
{
  "version": 1,
  "created_at": "2026-04-18T00:00:00.000Z",
  "updated_at": "2026-04-18T00:00:00.000Z",
  "project_id": "my-project",
  "workspace_name": "my-project",
  "artifacts": []
}
```

Older v1 manifests without `project_id` and `workspace_name` still validate. Running `reffy init` migrates managed manifests by adding those fields with deterministic defaults derived from the repository name.

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
