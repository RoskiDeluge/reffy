# reffy

[![npm version](https://img.shields.io/npm/v/reffy-cli.svg)](https://www.npmjs.com/package/reffy-cli)
[![MIT License](https://img.shields.io/github/license/RoskiDeluge/reffy-ts.svg)](LICENSE)
[![CI](https://github.com/RoskiDeluge/reffy-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/RoskiDeluge/reffy-ts/actions/workflows/ci.yml)

Reffy is a planning system for AI assisted development. It keeps ideation artifacts in straightforward version-controlled markdown files and manages formal planning files under `.reffy/reffyspec/`.

## Install

```bash
npm install -g reffy-cli@latest
```

You can also install the published CLI with pnpm, for example `pnpm add -g reffy-cli@latest`. The package manager you choose only controls how the CLI package is installed and cached on your machine. Reffy itself does not install dependencies or force npm/pnpm/yarn in the repositories where you run `reffy`; it writes and validates the `.reffy/` planning workspace using Node.js filesystem APIs.

## Quickstart (CLI-only)

Inside your project:

```bash
cd your-project
reffy init
```

Command summary:

- `reffy init`: runs the canonical first-run setup flow, creates the `.reffy/` and `.reffy/reffyspec/` structure, writes managed instructions, reindexes artifacts, and on first-run text output prints a copy/paste instruction for your agent harness.
- `reffy bootstrap`: compatibility alias for `reffy init`.
- `reffy doctor`: diagnoses required Reffy setup and workspace health.
- `reffy reindex`: reconciles `.reffy/manifest.json` with `.reffy/artifacts` by adding missing files and removing stale entries.
- `reffy validate`: validates `.reffy/manifest.json` against manifest v1 contract.
- `reffy summarize`: generates a read-only handoff summary from indexed artifacts.
- `reffy plan create`: generates proposal, task, design, and spec scaffolds from indexed Reffy artifacts.
- `reffy plan validate|list|show|archive`: manages the planning lifecycle under `.reffy/reffyspec/`.
- `reffy spec list|show`: inspects current spec state under `.reffy/reffyspec/`.
- `reffy skill list|show|create|validate`: lists, prints, scaffolds, and validates task-oriented skills under `.reffy/skills/`.
- `reffy remote init|status|push|ls|cat|snapshot`: links, publishes, and inspects a [Paseo-backed remote `.reffy/` workspace](.reffy/artifacts/paseo-backed-remote-workspace.md).
- `reffy remote workspace create|get` and `reffy remote project register|list`: control-plane operations against the workspace manager actor.
- `reffy diagram render`: renders Mermaid diagrams as SVG or ASCII, including spec-aware generation from compatible `spec.md` files.

Run `reffy <command> --help` for the full flag list of any command. Most commands accept `--repo PATH` so they can be invoked from outside the project root (useful for agent harnesses).

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
reffy skill list --output json
reffy skill show create-change
reffy skill create my-workflow
reffy skill validate
reffy remote init --provision
reffy remote status --output json
reffy remote push
reffy remote ls
reffy remote cat .reffy/manifest.json
reffy diagram render --stdin --format svg < diagram.mmd
reffy diagram render --input .reffy/reffyspec/specs/auth/spec.md --format ascii
reffy diagram render --input .reffy/reffyspec/specs/auth/spec.md --format svg --output .reffy/artifacts/auth-spec.svg
```

## Diagnostics and Inspection

### `reffy doctor`

Audits the local Reffy setup: the `.reffy/` workspace exists, `manifest.json` is valid, managed `AGENTS.md` blocks are in place, and optional tooling (mermaid CLI) is reachable. Useful as a first step when a command is misbehaving in an unfamiliar repo.

```bash
reffy doctor                  # human-readable check list
reffy doctor --output json    # machine-readable for CI
```

### `reffy summarize`

Produces a read-only handoff summary of indexed artifacts — titles, kinds, tags, related changes, derived outputs. Use it to brief a fresh agent or to audit what context has accumulated under `.reffy/artifacts/` without opening every file.

```bash
reffy summarize               # text overview grouped by kind
reffy summarize --output json # full structured payload
```

### `reffy spec list|show`

Inspects the current truth in `.reffy/reffyspec/specs/`. Each capability has its own spec file with requirements and scenarios; `list` enumerates capabilities, `show` prints one spec's requirements.

```bash
reffy spec list
reffy spec show remote-workspace-manager --output json
```

## Skills

Reffy gives *procedures* the same deterministic treatment it gives data. Skills are named, agent-readable task recipes that live as files under `.reffy/skills/`, one directory per skill:

```
.reffy/skills/
├── create-change/
│   └── SKILL.md
└── <your-skill>/
    └── SKILL.md
```

Each `SKILL.md` uses [Agent Skills](https://agentskills.io/specification) YAML frontmatter followed by Markdown instructions. Only `name` and `description` are required. Descriptions explain what the skill does and when to select it.

```markdown
---
name: create-change
description: Create a ReffySpec proposal. Use when asked to plan a change or turn research into spec deltas and implementation tasks.
compatibility: Requires the Reffy CLI and an initialized Reffy workspace.
metadata:
  reffy-managed: "true"
  reffy-commands: '["reffy plan create", "reffy plan validate"]'
---

## Steps
1. ...
```

- Standard optional fields (`license`, `compatibility`, `metadata`, `allowed-tools`) are preserved. Metadata values must be strings.
- Reffy extensions use `metadata.reffy-managed` (`"true"` or `"false"`), `metadata.reffy-commands` (a JSON array string), and optional `metadata.reffy-triggers` (a JSON array string). Triggers supplement the description; they are never required.
- `reffy doctor` checks normalized command declarations for stale references. Declarations do not grant execution permission.
- `reffy init` ships and refreshes seven CLI-owned skills: `create-artifact`, `create-change`, `archive-change`, `supersede-change`, `inspect-specs`, `sync-remote`, and `diagnose`. It preserves user-owned skills and reports reserved-name ownership collisions.

```bash
reffy skill list                       # names, descriptions, ownership, and paths
reffy skill list --output json         # descriptors + absolute locations + diagnostics
reffy skill show create-change         # selected instructions
reffy skill create my-workflow         # standard unmanaged scaffold
reffy skill validate                   # standard constraints with legacy compatibility
reffy skill validate --standard        # reject all nonstandard top-level fields
reffy skill migrate                    # explicitly convert all legacy headers
reffy skill migrate my-workflow        # explicitly convert one header
reffy skill export --target agents     # opt-in native discovery installation
```

JSON list/show retain `name`, `description`, `triggers`, `commands`, `managed`, and repository-relative `path`; add absolute `location` and supplied standard fields. Only show includes `body`. Structured diagnostics identify invalid skills without concealing valid siblings; text diagnostics go to stderr. Skills remain filesystem-discovered and are not indexed in the artifact manifest.

Validation checks real YAML, required strings, name/directory agreement and uniqueness, 64-character names, 1,024-character descriptions, optional compatibility of 1–500 characters, and field/metadata types. Names support lowercase Unicode alphanumeric characters and single internal hyphens. Names and directory names compare after NFKC normalization. Legacy top-level `triggers`, `commands`, and `managed` are readable with warnings in default mode. This compatibility success does not establish standard conformance. Strict mode rejects these fields. Migration preflights selected files and preserves instruction bodies and support files; conflicting old/new values or unknown fields fail instead of being discarded. Repeated migration is a no-op. Initialization converts known CLI-owned built-ins through regeneration; custom files change only with explicit migration.

Native export copies complete standard-valid skill directories into `.agents/skills/<name>/`, preserving supporting paths and executable permissions. `.reffy/skills/` remains canonical. Re-run export after source updates; ordinary init does not create or refresh exports. Reffy tracks hashes and ownership in `.reffy/skill-exports.json` and refuses untracked destinations, local edits, unexpected resources, and symlinks. Re-export updates or removes only previously owned, unmodified content. An I/O interruption retains a recovery journal for retry. Keep the ownership state with the exported files; identical content alone does not establish ownership. No force-overwrite mode is provided.

Managed AGENTS guidance routes agents through description-first discovery and selected-file loading. Supporting references resolve relative to the skill directory; `.reffy/` procedure paths identify the repository workspace. Remote workspace, remote sync, shared-reference publication, and Paseo requests route to `sync-remote`; loading instructions does not authorize a remote push.

For the test-only upstream validation gate, install `scripts/skills-ref-requirements.txt` in a Python environment and run `pnpm test:skill-conformance` (or set `SKILLS_REF_BIN` to its executable). Core CLI commands remain offline and require no Python. See [skill evaluation notes](test/fixtures/skill-evaluation.md) for representative selection/workflow checks and known integration limits.

## Remote Sync

Reffy can publish the local `.reffy/` workspace to a [Paseo-backed remote workspace](.reffy/artifacts/paseo-backed-remote-workspace.md) and inspect it later with native CLI commands. The linked overview explains what the optional remote provides, how it relates to local-first Reffy, and the current access model.

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

Every Paseo request from the CLI carries `Authorization: Bearer ${PASEO_TOKEN}`, except the two provisioning calls made by `reffy remote init --provision`: `POST /pods` is unauthenticated, and `POST /pods/{pod}/actors` carries the provisioning credential (see below). The token is the only thing that grants access — manager / workspace-backend identifiers in `.reffy/state/remote.json` are inert without it.

Required env for any remote command:

```bash
PASEO_ENDPOINT="https://your-paseo-endpoint.example"
PASEO_TOKEN="<bearer token issued by manager provisioning>"
```

Both must be present; the CLI fails fast and names the missing variable before issuing any network call. Endpoint is **never** persisted to `remote.json`. The token is **never** persisted anywhere by the CLI.

### First-time provisioning

```bash
PASEO_ENDPOINT="https://your-paseo-endpoint.example" \
PASEO_PROVISIONING_TOKEN="<provisioning credential from the Paseo operator>" \
  reffy remote init --provision
```

`--provision` creates a fresh pod and `reffyWorkspaceManager.v1` actor. Creating the actor requires `PASEO_PROVISIONING_TOKEN`, the deployment's provisioning credential held by the Paseo operator. The CLI sends it only on the actor-creation request, never persists it, and never uses it in place of `PASEO_TOKEN` (or vice versa). If it is missing, `init --provision` fails before any network call. Joining an existing manager does not need it. The manager mints a bearer token and the CLI prints it once with strong "save this now" guidance. Save it to your team secret store immediately — the CLI does not keep a copy.

The new manager is a Paseo **application** that the deployment registers with its control plane. `init --provision` sends an application descriptor with it:

- `name` — the workspace id (override with `--name`)
- `description` — `--label` when given, otherwise `Reffy workspace backend for <workspace-id>` (override with `--description`)
- `owner` — `--owner`, else `PASEO_APPLICATION_OWNER`, else the repo's `git config user.email`; omitted when none is set

The output shows the descriptor sent and the application Paseo stored, and the returned application id is saved as `application_id` in `.reffy/state/remote.json`.

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
  "application_id": "...",
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
reffy remote application get
reffy remote application set [--name <text>] [--description <text>] [--owner <text>]
```

`application set` merges only the fields you pass into the manager's application descriptor (use it to describe managers provisioned before descriptors were sent); Paseo re-registers the updated descriptor with its control plane.

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

### Planning lifecycle

The end-to-end arc for a non-trivial change:

```bash
# 1. Capture raw context as artifacts. Each artifact is a free-form
#    markdown note; reindex registers it in the manifest.
echo "..." > .reffy/artifacts/login-flow-idea.md
reffy reindex

# 2. Scaffold a ReffySpec change from selected artifacts. This creates
#    .reffy/reffyspec/changes/add-login-flow/ with proposal, design,
#    tasks, and a placeholder spec delta — all linked back to the
#    artifacts you passed in.
reffy plan create \
  --change-id add-login-flow \
  --artifacts login-flow-idea.md \
  --title "Add login flow"

# 3. Edit the generated files:
#    - proposal.md: Why / What Changes / Impact / Reffy References
#    - design.md: decisions, data model, open questions
#    - tasks.md: implementation + verification checklists
#    - specs/<capability>/spec.md: ADDED / MODIFIED / REMOVED / RENAMED requirements
#      with at least one Scenario each

# 4. Validate before implementing. Catches missing scenarios, malformed
#    delta sections, and broken artifact references.
reffy plan validate add-login-flow

# 5. Implement, tick tasks in tasks.md as you go, re-validate.

# 6. Archive once shipped. Moves the change under
#    .reffy/reffyspec/changes/archive/<date>-<change-id>/ and merges
#    the delta spec(s) into the canonical specs in
#    .reffy/reffyspec/specs/.
reffy plan archive add-login-flow
```

The active-change tree is exhaustive:

```text
.reffy/reffyspec/changes/<change-id>/
├── proposal.md
├── tasks.md
├── design.md                         # optional
└── specs/
    └── <capability>/
        └── spec.md
```

Additional change-local files and directories are not supported. Put durable architecture and operational decisions in `design.md`, actionable checklists in `tasks.md`, and exploratory material in indexed `.reffy/artifacts/`. Repositories that previously relied on arbitrary sibling documents must consolidate or relocate them before `reffy plan validate` or `reffy plan archive` will succeed.

Renames use paired source and destination headings; they can be followed by a `MODIFIED` block under the new name:

```md
## RENAMED Requirements
- FROM: `### Requirement: Login`
- TO: `### Requirement: User Authentication`
```

Useful side commands during the arc:

- `reffy plan list` — enumerate active and archived changes.
- `reffy plan show <change-id>` — inspect one change's state without opening every file.
- `reffy spec list` / `reffy spec show <capability>` — see the canonical specs the deltas will land into.

### Representing pivots

Pivots, deprecations, and wind-downs are not a separate concept in ReffySpec — they are ordinary changes whose delta is mostly REMOVED or MODIFIED requirements instead of ADDED ones. Because every change's `specs/<capability>/spec.md` is already a delta against the canonical spec, a course correction reuses the same machinery as a feature addition: scaffold a change, author a delta that removes or rewrites the relevant requirements, pair it with code-removal tasks, and archive it when shipped. The history of pivots stays legible as a series of deltas under `changes/archive/`, rather than getting buried in code commits.

There is no pivot command and no per-requirement "deprecated" flag: signaling a change of direction just requires another change. The archive is append-only — you never edit or delete an archived change to reverse it; you land a new change on top, and canonical `specs/` always reflects current truth. When a change reverses or replaces a prior one, name the prior change-id(s) in an optional `## Supersedes` section of `proposal.md`:

```md
## Supersedes
- add-old-direction
```

This is a navigational pointer that keeps the lineage explicit; the spec delta remains the authoritative record of what actually changed. `reffy plan create` scaffolds the `## Supersedes` section (defaulting to `None`) so the convention is there when you need it.

### Reference implementation in this repo

- `AGENTS.md`: contains both managed instruction blocks and encodes sequencing.
- `AGENTS.md`: Reffy block routes ideation/exploration requests to `@/.reffy/AGENTS.md`.
- `AGENTS.md`: ReffySpec block routes planning/proposal/spec requests to `@/.reffy/reffyspec/AGENTS.md`.
- `.reffy/AGENTS.md`: defines the artifact and ideation workflow.
- `.reffy/reffyspec/AGENTS.md`: defines the ReffySpec planning/spec workflow conventions used in this repo.
- `.reffy/reffyspec/project.md`: captures durable project context for agents, including purpose, stack, architecture, conventions, and constraints.

## Develop

For local development of this repo:

```bash
corepack enable
pnpm install
pnpm build
pnpm check
pnpm test
```

`pnpm install` runs this package's `prepare` step, which builds `dist/` automatically. Use `pnpm reffy <args>` to exercise the built local CLI through `dist/cli.js`; this avoids accidentally invoking a globally installed `reffy` while working in this repo.

## Changelog and releases

[CHANGELOG.md](CHANGELOG.md) records user-facing changes. Add concise notes under `Unreleased` in feature/fix PRs. CI checks the changelog structure and that its newest release matches `package.json`.

To prepare a release, run **Actions → Prepare Release → Run workflow** on the default branch and supply the next stable `X.Y.Z` version. The workflow moves Unreleased notes into a dated section, updates the package version, and opens a release PR. It explicitly dispatches CI on that branch. Enable GitHub Actions PR creation in the repository's Actions settings for this workflow; its built-in token needs contents, pull-request, and workflow-dispatch permissions.

Review and merge the release PR, then create and push the matching `vX.Y.Z` tag on that merged commit. The existing tag workflow publishes npm and uses the matching changelog section as GitHub release notes. Release preparation does not merge, tag, or publish. Existing release branches are preserved; if preparation was interrupted after pushing, review that branch and open its PR/dispatch CI manually instead of overwriting it.

The same preparation is available locally:

```bash
pnpm release:prepare 1.10.0
pnpm changelog:check
```

The version is an example; choose the next version for the intended compatibility change. Empty Unreleased notes, invalid versions, and downgrades fail before editing files. Repeating preparation for the current version makes no changes. Older release history remains linked from the changelog rather than reconstructed from commit messages. The changelog is included in the npm package.

## Release Security

Reffy publishes from GitHub Actions using npm trusted publishing with provenance enabled.

To verify an installed package:

- Check the package provenance details on npm.
- Run `npm audit signatures` after install to verify registry signatures and available provenance attestations.
