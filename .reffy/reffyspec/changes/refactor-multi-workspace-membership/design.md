## Context
The current manifest identity spec says `.reffy/manifest.json` owns `project_id` and `workspace_name`. The current remote sync spec says identity-aware remote workflows use those fields as the local workspace identity and compare them to a linked remote workspace.

### Problem Summary
- `workspace_name` is singular, but the same `.reffy/` source tree may need membership in multiple higher-level planning workspaces.
- `project_id` and workspace identity are currently easy to duplicate, which hides the fact that they describe different concepts.
- Remote linkage state is singular, so it cannot cleanly represent one source tree with multiple Paseo publication targets.
- Remote push needs an explicit projection target before it can publish the local `.reffy/` tree into a multi-workspace backend model.
- The v1 Paseo backend actor shape was safe only while one actor represented one workspace projection; the deployed `reffyRemoteBackend.v2` actor resolves this by keying documents and locks by `(workspace_id, path)` and scoping replace/prune import semantics to a single `workspace_id`, so one actor can safely hold multiple projections.

## Goals / Non-Goals
Goals:
- Define manifest source identity separately from workspace membership.
- Make plural workspace membership the canonical manifest model.
- Preserve a migration path for existing `workspace_name` manifests.
- Make remote linkage and push operate against a selected workspace projection.
- Ensure remote push can publish newly created `.reffy/` directories and planning documents to Paseo for the selected projection.
- Target the deployed `reffyRemoteBackend.v2` contract: one Reffy source tree published into one or more selected workspace projections addressed through `/workspaces/{workspace_id}/...` routes on a shared backend actor.
- Allow already-provisioned v1 backend actors to be replaced by reinitializing linkage against v2 and repushing the local `.reffy/` tree.

Non-Goals:
- Bidirectional sync, merge, or conflict resolution.
- Cross-workspace query or retrieval UX.
- Nuveris portfolio orchestration behavior beyond local membership and publication contracts.
- A generic backend abstraction unrelated to the existing Paseo step-1 remote path.
- A backend manager actor for discovery and provisioning registries.

## Decisions
- Decision: Keep `project_id` as the stable source identity.
  - Rationale: Existing usage already points to `project_id` as the repository or planning-tree identity. Keeping it stable avoids forcing workspace membership concerns into source identity.
- Decision: Introduce `workspace_ids` as the canonical plural membership field.
  - Rationale: Membership needs stable machine identifiers. Display names can be added later if needed, but the core contract should not depend on human-oriented names.
- Decision: Treat `workspace_name` as deprecated compatibility input.
  - Rationale: Existing v1 manifests should continue to validate and migrate. New manifests should not rely on singular workspace identity as canonical state.
- Decision: Store remote targets outside the manifest and key them by `workspace_id`.
  - Rationale: The manifest should describe what the local `.reffy/` tree is and where it belongs; remote state should describe where a selected projection is published.
- Decision: Require explicit workspace selection when more than one membership could apply.
  - Rationale: Silent publication to the wrong workspace would be worse than requiring `--workspace-id` or a configured default.
- Decision: Target the deployed `reffyRemoteBackend.v2` actor contract.
  - Rationale: v2 already implements workspace-scoped document keys, workspace-scoped locks, the `/workspaces/{workspace_id}/...` route surface, and `source` plus `workspace` identity envelopes. Reffy can map its plural workspace membership directly onto that contract without requiring further backend changes for this refactor.
- Decision: Do not require old v1 backend actor compatibility.
  - Rationale: Local manifests still need migration, but v1 remote actors can be recreated as v2 and repopulated by `reffy remote init` plus `reffy remote push`. That keeps the backend transition smaller and avoids carrying `workspace_name` as a canonical backend contract.

## Data Model
Directionally, new manifests should look like:

```json
{
  "version": 1,
  "project_id": "my-project",
  "workspace_ids": [
    "my-project",
    "portfolio-alpha",
    "nuveris-cross-project-planning"
  ],
  "artifacts": []
}
```

Older manifests with `workspace_name` should be accepted and migrated as:

```json
{
  "project_id": "my-project",
  "workspace_name": "my-project"
}
```

to:

```json
{
  "project_id": "my-project",
  "workspace_ids": ["my-project"]
}
```

Remote linkage should evolve from a single target to a target map or equivalent list keyed by `workspace_id`. The exact persisted shape can be settled during implementation, but it must preserve multiple targets without duplicating `project_id` into each target as if it were a workspace id.

Directionally, local remote linkage should look like:

```json
{
  "version": 2,
  "provider": "paseo",
  "endpoint": "https://paseo-core.example",
  "targets": {
    "workspace-a": {
      "pod_name": "pod-id",
      "actor_id": "actor-id"
    },
    "workspace-b": {
      "pod_name": "pod-id",
      "actor_id": "actor-id"
    }
  }
}
```

The selected Paseo backend actor should be treated as:

```text
one reffy remote backend actor holds one source tree published into one or more selected workspace projections,
with each projection addressed through /workspaces/{workspace_id}/... routes
```

Under the deployed v2 contract, every response includes a `source` envelope with `actor_type`, `version`, and `project_id`, and projection-scoped responses additionally include a `workspace` envelope with `workspace_id`, for example:

```json
{
  "source": {
    "actor_type": "reffyRemoteBackend",
    "version": "v2",
    "project_id": "source-project-id"
  },
  "workspace": {
    "workspace_id": "selected-workspace-id"
  }
}
```

Top-level `workspace_name` is not required as a backend compatibility field for this refactor. If a linked actor reports v1 `workspace_name` and cannot report or validate a v2 `workspace_id`, Reffy should guide the user to reinitialize the target against the v2 contract and repush the local `.reffy/` tree.

## Reffy Inputs
- multi-workspace-membership.md
- paseo-multi-workspace-refactor.md
- paseo-contract-reference-for-reffy.md

## Open Questions
- Should Reffy support a persisted default workspace id, or should CLI commands infer only when `workspace_ids.length === 1` and require `--workspace-id` otherwise?
- Should the first implementation name the selection flag `--workspace-id` everywhere, or keep a shorter `--workspace` alias for CLI ergonomics?
