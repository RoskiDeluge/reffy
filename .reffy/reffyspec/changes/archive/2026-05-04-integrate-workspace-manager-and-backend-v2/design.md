# Design: Integrate Workspace Manager v1 and Backend v2

## Context
Reffy CLI currently models the Paseo remote as one backend actor per source `project_id` that holds many workspace projections, addressed through `/pods/{pod}/actors/{actor}/workspaces/{workspace_id}/...`. Local linkage is a v2 `remote.json` mapping each `workspace_id` to one `{pod_name, actor_id}` pointing at that combined backend.

The deployed Paseo contract has moved to a two-actor model:

- `reffyWorkspaceManager.v1` is the control plane. It owns workspace lifecycle and project registration. It returns the workspace backend actor identity for each `workspace_id`.
- `reffyRemoteBackend.v2` is the storage plane. One actor instance represents one shared `workspace_id`. Routes are rooted at `/pods/{pod}/actors/{workspace_actor_id}/workspace/...` and per-project flows live under `/workspace/projects/{project_id}/...`.

The integration handoff in `reffy-cli-v2-paseo-reffy-backend.md` is the authoritative description of this contract for the CLI.

### Problem Summary
- The CLI's single-actor mental model conflates "where a workspace lives" with "where a project's contribution to a workspace lives". Under the new contract those are different actors.
- The CLI assumes it can address a workspace as a path segment inside a shared backend actor. The new contract makes the workspace itself the actor, with no `workspace_id` segment in storage routes.
- The CLI does not have a notion of registering a project into a workspace before pushing. Under the new contract, pushing into an unregistered project is a contract violation.
- The CLI's `remote.json` v2 shape persists per-workspace `{pod_name, actor_id}` pointing at a combined backend. It has no slot for the manager identity that is global to a linkage and no slot for the workspace backend actor identity that is global to a `workspace_id`.

## Goals / Non-Goals
Goals:
- Speak the live two-actor contract directly: manager actor for lifecycle and registration, workspace backend actor for import and reads.
- Persist linkage in a shape that preserves manager identity once and workspace backend identity per `workspace_id`.
- Make project registration an explicit, observable step in the CLI flow rather than an implicit side effect of import.
- Provide a recovery path when local linkage has drifted from the manager's view (resolve through the manager and refresh local state).
- Keep the local `.reffy/` tree as the source of truth so that abandoned remote actors can be replaced and repopulated cleanly.

Non-Goals:
- Bidirectional sync, merge, or conflict resolution.
- Workspace-owned shared documents under `/workspace/documents` (controller-style notes). These are not needed for source push.
- The lock API. Source import uses bulk import, not path-by-path mutation, so locks are not required for this change.
- Compatibility with the previous combined-backend `remote.json` v2 shape. Users reinitialize against the manager and repush.
- A persisted default workspace selector. Existing `workspace_ids` selection rules remain.

## Decisions
- Decision: Split the CLI's remote client into a manager client and a workspace backend client.
  - Rationale: The two surfaces have different base URLs and different responsibilities. A single client class would have to switch base URLs on every call and would blur the contract. The two-client split mirrors how the artifact describes the surfaces.
- Decision: Persist remote linkage as version 3 with a global `manager` block and a per-workspace `workspace_backend` block.
  - Rationale: Manager identity is global to the linkage file; the same manager actor resolves and registers across many workspaces. Workspace backend identity is per `workspace_id`. Encoding both directly in `remote.json` avoids re-resolution on every command.
- Decision: Treat the v2 `remote.json` shape as legacy and refuse to migrate it silently.
  - Rationale: The v2 shape points at a combined backend actor that no longer exists in this model. The safe path is the same one used for the v1 to v2 transition: emit a clear reinitialization error rather than guess at a migration.
- Decision: Make project registration a precondition for `remote push` and surface it as its own step.
  - Rationale: The backend treats import-before-register as a contract violation. The CLI should make the registration call observable so users understand the new contract, with idempotent retry on `409` to keep the flow ergonomic.
- Decision: Add a recovery path that resolves workspace backend identity through the manager when local state is missing or stale.
  - Rationale: Manager identity is the durable anchor. If local `workspace_backend` state is lost or wrong, the CLI can call `GET /workspaces/{workspace_id}` to recover it without forcing reprovisioning.
- Decision: Add explicit `reffy remote workspace` and `reffy remote project` subcommands.
  - Rationale: Workspace lifecycle and project registration are now first-class control-plane operations. Hiding them inside `init` would obscure the contract and make recovery flows awkward. Exposing them keeps `init` thin and gives users a direct surface for the manager actor.
- Decision: Auto-register the local `project_id` during `reffy remote init` for a selected workspace.
  - Rationale: Most users want a single command that gets them to a working push. Auto-register on init plus the standalone `project register` subcommand covers both.
- Decision: Keep this change scoped to source-owned import and read flows.
  - Rationale: The artifact explicitly notes that workspace-owned documents and locks are not needed for source push. Adding them in the same change widens the diff without serving the immediate goal.

## Data Model

### Local remote linkage (v3)
The `remote.json` file evolves from a v2 single-tier target map to a v3 two-tier shape:

```json
{
  "version": 3,
  "provider": "paseo",
  "endpoint": "https://paseo-core.example",
  "manager": {
    "pod_name": "pod-id",
    "actor_id": "manager-actor-id"
  },
  "targets": {
    "workspace-a": {
      "workspace_backend": {
        "pod_name": "pod-id",
        "actor_id": "workspace-actor-id"
      },
      "last_imported_at": "2026-05-03T00:00:00.000Z"
    },
    "workspace-b": {
      "workspace_backend": {
        "pod_name": "pod-id",
        "actor_id": "workspace-actor-id"
      }
    }
  }
}
```

Invariants:
- `manager` is global to the linkage file.
- `targets[workspace_id].workspace_backend` is the storage-plane actor identity for that workspace.
- `last_imported_at` remains a per-target metadata field maintained by `remote push`.

### Manager actor surface (read-only contract reference)
- `POST /pods/{pod}/actors/{manager_actor_id}/workspaces` - create a workspace and provision its backend actor.
- `GET /pods/{pod}/actors/{manager_actor_id}/workspaces/{workspace_id}` - resolve workspace and recover its backend actor identity.
- `POST /pods/{pod}/actors/{manager_actor_id}/workspaces/{workspace_id}/projects/{project_id}` - register a project before its first import.
- `GET /pods/{pod}/actors/{manager_actor_id}/workspaces/{workspace_id}/projects` and `.../projects/{project_id}` - inspect registrations.

### Workspace backend actor surface (read-only contract reference)
- `GET /pods/{pod}/actors/{workspace_actor_id}/workspace` - workspace summary.
- `GET /workspace/projects` and `GET /workspace/projects/{project_id}` - registered project state.
- `POST /workspace/projects/{project_id}/import` - bulk source import for one project contribution.
- `GET /workspace/projects/{project_id}/documents` and `GET /workspace/projects/{project_id}/documents?path=...` - per-project document list and read.
- `GET /workspace/projects/{project_id}/snapshot` - per-project snapshot.

### Error contract for the CLI
- `404 workspace` - workspace does not exist on the manager. CLI guides the user to `reffy remote workspace create`.
- `404 project` on import or read - project not registered for that workspace. CLI guides the user to `reffy remote project register`.
- `409 workspace create` - workspace already exists. CLI recovers by calling `GET /workspaces/{workspace_id}` and continues.
- `409 project register` - project already registered. CLI treats as success.
- Identity envelope mismatch on a workspace summary (for example a v1 actor that does not expose `workspace_id`) - CLI fails with the same reinitialization guidance used for v1 to v2.

## Reffy Inputs
- reffy-cli-v2-paseo-reffy-backend.md
- paseo-contract-reference-for-reffy.md
- multi-workspace-membership.md

## Open Questions
- Should `reffy remote init` accept a single combined flag that means "create if missing, resolve if present" for the workspace, or should `--create` and `--resolve` remain explicit alternatives? The current proposal favors explicit subcommands plus an `init` convenience that defaults to resolve and falls back to create on `404` only when the user passes an explicit creation intent.
- Should the linkage file allow more than one manager identity, for example to support testing against staging and production from the same repo, or is one manager per linkage file the right invariant for now? The current proposal assumes one manager per linkage file and defers multi-manager support.
- Should `reffy remote push` emit a separate registration audit line in its output, or fold it into the existing summary? The current proposal favors a separate line so the new contract is visible.
