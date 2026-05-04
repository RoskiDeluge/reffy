# Change: Integrate Workspace Manager v1 and Backend v2

## Why
The Paseo side of the Reffy backend has been refactored into two distinct actor surfaces. The control plane is now `reffyWorkspaceManager.v1`, which owns workspace lifecycle and project registration. The storage plane is now `reffyRemoteBackend.v2`, where each actor instance represents one shared `workspace_id` and accepts contributions from many local projects keyed by `project_id`.

Reffy CLI today targets the older single-actor model where one backend actor served multiple workspace projections through `/pods/{pod}/actors/{actor}/workspaces/{workspace_id}/...` routes. Under the new contract:

- Workspace identity is actor identity. One workspace is one backend actor, not a projection inside a shared backend.
- Project identity is contribution identity. Each local repo pushes as one contribution namespace inside a shared workspace.
- Workspace lifecycle (create, resolve) and project registration happen through a separate manager actor, not the storage actor.
- Source import moves from `/workspaces/{workspace_id}/import` on a combined backend to `/workspace/projects/{project_id}/import` on the workspace backend actor.
- A project must be registered through the manager before its first import; importing before registration is a backend contract violation.

The CLI must be updated to speak this two-surface contract directly rather than try to preserve the older projection-based shape.

## What Changes
- Persist remote linkage in a v3 shape that captures manager identity once per linkage file and a per-workspace `workspace_backend` identity, replacing the v2 single-target-per-workspace shape.
- Add an explicit manager control-plane surface in the CLI for workspace create, workspace resolve, and project registration, separate from the storage plane.
- Treat project registration as a required precondition for source import rather than relying on implicit backend creation.
- Move source import calls to the workspace backend actor's `/workspace/projects/{project_id}/import` route.
- Update remote read commands (`status`, `ls`, `cat`, plus an added `snapshot`) to read against the workspace backend actor's per-project document and snapshot routes.
- Provide actionable errors and recovery guidance for the new failure modes the contract introduces: missing workspace, unregistered project, lost workspace backend identity, and version mismatch.
- Do not require compatibility with v2 linkage files that point at a combined backend actor; users reinitialize linkage against the manager and repush.
- Scope this change to source-owned import and read flows. Workspace-owned shared documents and the lock API are out of scope and remain available for a follow-up change if Reffy starts doing direct document edits.

## Impact
- Affected specs:
  - `remote-sync-snapshot-publication`
  - `remote-workspace-manager` (new)
- Affected code:
  - `src/types.ts`
  - `src/remote.ts`
  - `src/cli.ts`
  - `README.md`
  - remote tests
- Affected user-facing behavior:
  - `reffy remote init` flag surface and required inputs
  - `reffy remote push` requires a registered project and uses a new import route
  - `reffy remote status`/`ls`/`cat` read against per-project routes on the workspace backend actor
  - New `reffy remote workspace ...` and `reffy remote project ...` subcommands

## Reffy References
- `reffy-cli-v2-paseo-reffy-backend.md` - integration handoff describing the live contract for `reffyWorkspaceManager.v1` and `reffyRemoteBackend.v2`, including manager and workspace backend route surfaces, expected local linkage shape, and recommended CLI flow.
- `paseo-contract-reference-for-reffy.md` - prior reference for the v2 backend identity envelopes.
- `multi-workspace-membership.md` - prior context for the source identity versus workspace membership split that this change builds on.
