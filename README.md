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
- `reffy remote init|status|push|ls|cat|snapshot`: links, publishes, and inspects a Paseo-backed remote `.reffy/` workspace.
- `reffy remote workspace create|get` and `reffy remote project register|list`: control-plane operations against the workspace manager actor.
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

## Remote Sync

Reffy can publish the local `.reffy/` workspace to a Paseo-backed remote workspace and inspect it later with native CLI commands.

The Paseo remote splits into two actor surfaces:

- `reffyWorkspaceManager.v1` is the **control plane**. It owns workspace lifecycle (create / get) and project registration.
- `reffyRemoteBackend.v2` is the **storage plane**. One actor instance represents one shared `workspace_id` and accepts contributions keyed by `project_id`.

Reffy stores manager identity once per linkage file and the workspace backend identity per `workspace_id`.

The current remote flow is:

1. Reffy reads `project_id` and `workspace_ids` from `.reffy/manifest.json`.
2. You select one workspace projection to act on. Reffy infers the selection when `workspace_ids` has exactly one entry; otherwise pass `--workspace-id <id>`.
3. Reffy connects to Paseo using `PASEO_ENDPOINT` or `--endpoint` and configured manager identity.
4. `reffy remote init` resolves (or creates) the workspace through the manager, persists the workspace backend identity, and registers the local `project_id` for that workspace.
5. `reffy remote push` registers the project if needed (idempotent on 409), then imports the full local `.reffy/` tree through `POST /workspace/projects/{project_id}/import` on the workspace backend actor with `replace_missing=true`.
6. `reffy remote status|ls|cat|snapshot` inspects the selected workspace projection per project on the workspace backend actor.

### Bearer-token authentication

Every Paseo request from the CLI carries `Authorization: Bearer ${PASEO_TOKEN}`. The token is the only thing that grants access — manager / workspace-backend identifiers in `.reffy/state/remote.json` are inert without it.

Required env for any remote command:

```bash
PASEO_ENDPOINT="https://your-paseo-endpoint.example"
PASEO_TOKEN="<bearer token issued by manager provisioning>"
```

Both must be present; the CLI fails fast and names the missing variable before issuing any network call. Endpoint is **never** persisted to `remote.json`. The token is **never** persisted anywhere by the CLI.

### First-time provisioning

```bash
PASEO_ENDPOINT="https://your-paseo-endpoint.example" reffy remote init --provision
```

`--provision` creates a fresh pod and `reffyWorkspaceManager.v1` actor. The manager mints a bearer token and the CLI prints it once with strong "save this now" guidance. Save it to your team secret store immediately — the CLI does not keep a copy.

After provisioning, export it for subsequent commands:

```bash
export PASEO_TOKEN="<token from init output>"
reffy remote status
```

Optional overrides:

- `PASEO_MANAGER_POD` and `PASEO_MANAGER_ACTOR` (or `--manager-pod` / `--manager-actor`) to reuse an existing manager actor instead of provisioning one.
- `--workspace-id <id>` when the manifest lists more than one `workspace_ids`.
- `--create` or `--resolve` to force-create or force-resolve the workspace through the manager during init. The default is "resolve when present, create when absent."

### Joining an existing manager from another repo

Drop the team's shared values into the new repo's `.env`:

```bash
PASEO_ENDPOINT="..."
PASEO_TOKEN="..."
PASEO_MANAGER_POD="..."
PASEO_MANAGER_ACTOR="..."
```

Then `reffy remote init --workspace-id <id>` resolves the workspace through the manager and registers the local project. No `--provision`, no new token issuance.

### Saved remote linkage

After `reffy remote init`, Reffy stores manager and workspace-backend identifiers in:

- `.reffy/state/remote.json`

```json
{
  "version": 4,
  "provider": "paseo",
  "manager": { "pod_name": "...", "actor_id": "..." },
  "targets": {
    "my-project": {
      "workspace_backend": { "pod_name": "...", "actor_id": "..." },
      "last_imported_at": "..."
    },
    "portfolio-alpha": {
      "workspace_backend": { "pod_name": "...", "actor_id": "..." }
    }
  }
}
```

Each `workspace_id` is its own backend actor. Manager identity is shared across workspaces in this linkage file.

The file deliberately does **not** contain the Paseo endpoint URL or the bearer token. Both are sourced from environment configuration on every command. Without `PASEO_TOKEN`, the identifiers in this file grant nothing.

If `workspace_backend` for a workspace is missing or stale, Reffy automatically resolves it through the manager and refreshes the linkage file before continuing.

### Control-plane subcommands

```bash
reffy remote workspace create <workspace-id> [--label "Pretty name"]
reffy remote workspace get <workspace-id>
reffy remote workspace delete <workspace-id> --yes
reffy remote project register [--workspace-id <id>] [--project-id <id>]
reffy remote project list [--workspace-id <id>]
```

`workspace delete` is destructive (it removes the shared workspace and all of its contributions) and requires `--yes` to proceed. The CLI also drops the workspace entry from the local linkage file on success, and treats a `404` from the manager as an idempotent "already gone" outcome.

These talk directly to the manager actor and let you provision or inspect state without re-running `init`.

### Example flow

```bash
reffy init
reffy remote init --provision
reffy remote status
reffy remote push
reffy remote ls
reffy remote cat .reffy/manifest.json
reffy remote snapshot
```

`reffy remote status` reports:

- the saved manager and workspace backend linkage for the selected workspace id
- the local manifest identity (source `project_id` and selected `workspace_id`)
- the remote workspace identity (`workspace.workspace_id`, `source.actor_type`, `source.version`)
- remote document counts and registered project counts when available

`reffy remote push` reports:

- whether the project was newly registered or already registered
- local document count
- imported / created / updated / deleted counts
- last imported timestamp

That makes the default prune/import behavior auditable without dropping to direct backend API calls.

## Manifest Contract

Reffy keeps workspace metadata in `.reffy/manifest.json`. New managed manifests separate stable source identity (`project_id`) from plural workspace membership (`workspace_ids`):

```json
{
  "version": 1,
  "created_at": "2026-04-18T00:00:00.000Z",
  "updated_at": "2026-04-18T00:00:00.000Z",
  "project_id": "my-project",
  "workspace_ids": ["my-project"],
  "artifacts": []
}
```

A single `.reffy/` tree can belong to more than one planning workspace:

```json
{
  "project_id": "my-project",
  "workspace_ids": ["my-project", "portfolio-alpha", "nuveris-cross-project-planning"]
}
```

Running `reffy init` populates `project_id` and `workspace_ids` with deterministic defaults derived from the repository name for any managed manifest that is missing them.

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
