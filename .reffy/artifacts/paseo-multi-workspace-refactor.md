# Reffy Multi-Workspace Paseo Backend Actor

## Why this artifact
This note analyzes how the current Paseo-side Reffy backend implementation needs to change for the multi-workspace membership proposal in `reffy-multi-workspace-feature.md`.

The key issue is that the current backend actor was designed around one source tree mapped to one remote workspace identity. The new Reffy model separates:
- `project_id` as the stable source identity for a local `.reffy/` tree
- `workspace_ids` as the workspace projections that include that source

That split affects both the backend actor that stores remote Reffy documents and the provisioning path that creates or links those backend actors.

## Current Paseo implementation
The current dedicated backend actor is `reffyRemoteBackend.v1`.

It is implemented by `src/handlers/reffyRemoteBackend.ts` and registered through `src/registry.ts`.

The current actor config supports:
- `params.project_id`
- `params.workspace_name`
- `params.default_lock_ttl_seconds`
- `params.max_snapshot_documents`

The actor stores one logical remote `.reffy/` workspace in two SQLite tables:
- `workspace_documents`, keyed by `path`
- `file_locks`, keyed by `path`

The public surface is document-centric:
- `GET /workspace`
- `GET /workspace/documents`
- `GET /workspace/snapshot`
- `POST /workspace/import`
- `POST /workspace/locks`
- `PUT /workspace/documents`
- `DELETE /workspace/documents`

This is a good v1 shape for a single remote projection. It is simple, deterministic, and already supports the important primitives:
- full `.reffy/` tree import
- path-addressed reads
- whole-workspace snapshots
- file-level locking
- simple metadata and document kind classification

## Where it conflicts with multi-workspace membership
The current model assumes a singular workspace identity.

That assumption appears in several places:
- actor config has `workspace_name`, not `workspace_id`
- the returned workspace identity has one `workspace_name`
- OpenAPI metadata exposes one `x-workspace.workspace_name`
- document rows are keyed only by `path`
- locks are keyed only by `path`
- `replace_missing=true` prunes every remote `.reffy/` document in the actor

Those choices are correct if each backend actor represents exactly one workspace projection.

They become dangerous if one actor tries to represent multiple workspace projections. In that case:
- `.reffy/manifest.json` for one projection could overwrite another
- a lock for `.reffy/artifacts/foo.md` would block the same path in every projection
- `replace_missing=true` could delete documents belonging to other projections
- status responses could not clearly distinguish source identity from selected workspace projection

So the current actor can survive the refactor only if we keep one backend actor scoped to one selected workspace projection.

## Near-term recommendation
For the next step, do not replace `reffyRemoteBackend.v1`.

Instead, reinterpret and lightly evolve it as:

`one reffyRemoteBackend actor = one source tree published into one workspace projection`

Under this model:
- `project_id` remains the stable source identity
- a new `workspace_id` config field identifies the selected workspace projection
- legacy `workspace_name` is accepted as a backward-compatible alias
<!-- I don't need to preserve backward-compatability. I'd rather re-push the updated .reffy instances into the new version of the reffy backend. -->
- Reffy local remote linkage stores multiple targets keyed by `workspace_id`
- `reffy remote push --workspace <workspace_id>` pushes the local `.reffy/` tree to the matching actor
<!-- I'm going to bring this suggestion into the reffy planning. -->

This keeps the current actor's table design valid because there is still only one projection per actor. It also keeps `replace_missing=true` safe because pruning remains scoped to that actor's single projection.

## Backend config shape
The actor config should move toward:

```json
{
  "actorType": "reffyRemoteBackend",
  "version": "v1",
  "schema": { "type": "object" },
  "params": {
    "project_id": "source-project-id",
    "workspace_id": "selected-workspace-id",
    "workspace_name": "legacy-or-display-name"
  }
}
```

`workspace_name` should become optional display or migration metadata, not the canonical projection key.

The actor should return identity like:

```json
{
  "source": {
    "project_id": "source-project-id"
  },
  "workspace": {
    "workspace_id": "selected-workspace-id",
    "workspace_name": "legacy-or-display-name"
  }
}
```

For compatibility, it can continue returning top-level `project_id` and `workspace_name` during the transition.

## Reffy remote linkage shape
The local Reffy side should no longer store one remote target.

Instead, remote linkage should be shaped around workspace projection targets:

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

This avoids forcing the backend actor to become multi-tenant before the product needs it.

It also matches the Reffy proposal's rule that workspace-projection commands must select a workspace id when membership is ambiguous.

## Provisioning implications
There are two separate concerns that should not be collapsed:
- the storage actor that represents one remote projection
- the provisioning or registry surface that creates and remembers those actors

The current Worker endpoint can already create actors with `POST /pods/{pod}/actors`.

For multi-workspace Reffy, the creation helper should become workspace-aware:
1. read local `project_id`
2. read local `workspace_ids`
3. require the user or command to select one `workspace_id`
4. create or link one `reffyRemoteBackend.v1` actor for that workspace id
5. write the resulting pod/actor identity into local remote linkage under that workspace id

This can initially live in Reffy CLI helper code rather than in a new Paseo actor.

## When to introduce a backend manager actor
A dedicated Paseo-side manager actor becomes useful only when actor creation and discovery need to be first-class runtime behavior.

That actor would not replace `reffyRemoteBackend`.

It would manage a registry like:
- `project_id`
- `workspace_id`
- `pod_name`
- `actor_id`
- created timestamps
- optional labels or display names

A possible actor type would be:
- `reffyBackendManager.v1`

Its responsibilities would be:
- create a backend actor for a selected workspace projection
- return an existing actor if the projection is already registered
- list known workspace projection backends for a source project
- validate that a backend actor's identity matches the requested source and workspace ids

The manager should not store `.reffy/` documents. It should only provision and discover storage actors.

## When to replace the current storage actor
Replace or version the current storage actor only if we decide one actor must hold multiple workspace projections.

That would require a real `reffyRemoteBackend.v2` design.

The v2 storage model would need:
- a `workspace_projections` table
- `workspace_documents` keyed by `(workspace_id, path)`
- `file_locks` keyed by `(workspace_id, path)`
- import pruning scoped to one `workspace_id`
- routes that include the selected workspace id
- status and snapshot APIs that make source identity and projection identity explicit

The route shape would probably become:
- `GET /workspaces/{workspace_id}`
- `GET /workspaces/{workspace_id}/documents`
- `GET /workspaces/{workspace_id}/snapshot`
- `POST /workspaces/{workspace_id}/import`
- `POST /workspaces/{workspace_id}/locks`

This is cleaner if one actor should serve as a source-project backend containing all projections. But it is a bigger migration and should not be the first move unless operational constraints require fewer actors.

## Recommended sequence
1. Keep `reffyRemoteBackend.v1` as a single-projection storage actor.
2. Add canonical `params.workspace_id` while accepting `params.workspace_name` for compatibility.
3. Update workspace responses and OpenAPI metadata to expose both source identity and workspace projection identity.
4. Update Reffy remote linkage to support multiple targets keyed by `workspace_id`.
5. Update provisioning helpers to create or link one actor per selected workspace id.
6. Add `reffyBackendManager.v1` only if runtime-side creation and discovery become common enough to justify it.
7. Design `reffyRemoteBackend.v2` only if one actor must store multiple workspace projections.

## Main design judgment
The safest path is to keep the current backend actor boring and projection-scoped.

The multi-workspace refactor should first change identity and linkage, not storage topology.

That means:
- Reffy owns source identity and workspace membership.
- Local remote config maps each selected workspace id to a Paseo backend actor.
- `reffyRemoteBackend.v1` stores exactly one projection.
- A future manager actor may create and catalog projection actors.
- A future v2 storage actor may support multiple projections inside one actor if that becomes necessary.

This gives the proposal a practical migration path without throwing away the working backend.
