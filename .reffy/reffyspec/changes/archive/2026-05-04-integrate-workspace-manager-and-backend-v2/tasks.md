## 1. Implementation
- [x] 1.1 Add a v3 `remote.json` shape to `src/types.ts` and `src/remote.ts` with a global `manager` block and a per-workspace `workspace_backend` block, and update read/write helpers to round-trip the new fields.
- [x] 1.2 Refuse to load v2 `remote.json` silently and emit a reinitialization error that points users at the new `reffy remote init` flow against the manager actor.
- [x] 1.3 Split the remote client into a manager client (`reffyWorkspaceManager.v1`) and a workspace backend client (`reffyRemoteBackend.v2`), with manager methods for `createWorkspace`, `getWorkspace`, `registerProject`, `listProjects`, and `getProject`, and workspace backend methods for `getWorkspace`, `importProject`, `listProjectDocuments`, `getProjectDocument`, and `getProjectSnapshot`.
- [x] 1.4 Update workspace backend route construction to use `/pods/{pod}/actors/{workspace_actor_id}/workspace/...` and per-project flows under `/workspace/projects/{project_id}/...`, dropping the old `/workspaces/{workspace_id}/...` segment from storage routes.
- [x] 1.5 Rewrite `reffy remote init` so it accepts manager identity inputs, persists the manager block, and for a selected workspace either resolves through the manager and stores returned workspace backend identity or creates the workspace when explicitly requested, then auto-registers the local `project_id`.
- [x] 1.6 Add a manager-facing subcommand surface: `reffy remote workspace create <workspace-id>`, `reffy remote workspace get <workspace-id>`, `reffy remote project register`, and `reffy remote project list`, each operating against the persisted manager identity.
- [x] 1.7 Rewrite `reffy remote push` to require a registered project, retry registration idempotently on 409, call `POST /workspace/projects/{project_id}/import` on the workspace backend actor, and update `last_imported_at` for the selected workspace target.
- [x] 1.8 Add a manager-mediated recovery path so `remote push` and `remote status` can re-resolve workspace backend identity when the local target is missing or stale, and refresh `remote.json` before continuing.
- [x] 1.9 Update `reffy remote status`, `reffy remote ls`, and `reffy remote cat <path>` to read against the workspace backend actor's per-project routes, and add `reffy remote snapshot` for `GET /workspace/projects/{project_id}/snapshot`.
- [x] 1.10 Update identity-envelope validation for the new workspace summary shape and emit reinitialization guidance when a linked workspace backend cannot expose a v2 `workspace_id` envelope.
- [x] 1.11 Map documented backend errors at the client layer so 404 workspace, 404 project, 409 workspace create, and 409 project register surface consistent CLI messages and recovery hints.
- [x] 1.12 Update help text, README, and any helper-script guidance to describe the manager and workspace backend split, the new `init` flow, and the new subcommands.
- [x] 1.13 Bump the package version and note the breaking change to `remote.json`.
- [x] 1.14 Add `PaseoManagerClient.deleteWorkspace` and a `reffy remote workspace delete <workspace-id> --yes` subcommand that calls `DELETE /workspaces/{id}` on the manager, removes the workspace entry from local `remote.json`, and treats 404 as a successful idempotent outcome.

## 2. Verification
- [x] 2.1 Run `reffy plan validate integrate-workspace-manager-and-backend-v2`.
- [x] 2.2 Run `npm run check`.
- [x] 2.3 Run `npm test`.
- [x] 2.4 Verify a v2 `remote.json` produces a clear reinitialization error and is not silently migrated.
- [x] 2.5 Verify `reffy remote init` for a fresh workspace creates the workspace through the manager, persists the workspace backend identity, and registers the local project.
- [x] 2.6 Verify `reffy remote init` for an existing workspace resolves through the manager and refreshes local workspace backend identity without creating a duplicate.
- [x] 2.7 Verify `reffy remote push` registers the project when needed, imports through `/workspace/projects/{project_id}/import`, and reports per-project import counts.
- [x] 2.8 Verify `reffy remote status`, `reffy remote ls`, `reffy remote cat`, and `reffy remote snapshot` operate against per-project routes on the workspace backend actor.
- [x] 2.9 Verify documented backend error responses (404 workspace, 404 project, 409 workspace create, 409 project register, identity envelope mismatch) produce the expected CLI guidance.
- [x] 2.10 Verified end-to-end against the deployed Paseo manager: `reffy remote workspace delete reffy --yes` returned `already_absent: false` + `local_target_removed: true`; a follow-up `workspace get reffy` returned 404; `reffy remote workspace delete probe-does-not-exist --yes` returned `already_absent: true` + `local_target_removed: false`.
