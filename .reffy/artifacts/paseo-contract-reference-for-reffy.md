# Reffy Remote Backend v2 — Frontend Contract Reference

## Purpose
This artifact is a bridge document for whoever is refactoring the frontend to align with the deployed `reffyRemoteBackend.v2` backend. It captures the live route surface, response shapes, and identity model so the frontend contract can be updated without re-reading the full handler implementation.

## Identity Model
v2 separates **source identity** from **workspace projection identity**.

- `project_id` is the stable source identity (one per actor).
- `workspace_id` is the projection identity (many per actor).
- An actor is provisioned with `project_id` required and `workspace_ids` optional (allow-list or lazy).

Source identity envelope (appears in every response):
```json
{
  "actor_type": "reffyRemoteBackend",
  "version": "v2",
  "project_id": "paseo-core-live-demo"
}
```

Workspace identity envelope (appears in projection-scoped responses):
```json
{
  "source": { "actor_type": "reffyRemoteBackend", "version": "v2", "project_id": "..." },
  "workspace": { "workspace_id": "paseo-core-project" }
}
```

## Live Endpoint
Base: `https://paseo-core.paseo.workers.dev`
Pod: `987045e8-a1f3-4888-9101-804ef8a9b25c`
Actor: `2e2a7bbe-a44e-431f-9197-0bd5f5eac568`

All routes below are relative to:
```
/pods/{pod}/actors/{actor}
```

## Route Surface

### GET /workspaces
Lists all workspace projections for this source project.

Response:
```json
{
  "source": { "actor_type": "...", "version": "v2", "project_id": "..." },
  "workspaces": [
    {
      "workspace_id": "paseo-core-project",
      "metadata": {},
      "created_at": 1777059619,
      "updated_at": 1777059619,
      "stats": {
        "document_count": 138,
        "artifact_count": 40,
        "spec_count": 6,
        "change_count": 4,
        "archive_count": 83
      }
    }
  ]
}
```

### GET /workspaces/{workspace_id}
Status for a single workspace projection.

Response:
```json
{
  "source": { ... },
  "workspace": { "workspace_id": "..." },
  "stats": { "document_count": 138, "artifact_count": 40, ... }
}
```

### GET /workspaces/{workspace_id}/documents
List or fetch documents. Query params:
- `path` — fetch a single document by exact path (CLI `cat` equivalent)
- `prefix` — filter by path prefix (CLI `ls` equivalent)
- `document_kind` — filter by kind (`artifact`, `manifest`, `spec`, `change`, `archive`, `other`)
- `include_content` — `true` (default) or `false` to omit content
- `limit` — max documents returned

Single document response (when `path` is provided):
```json
{
  "source": { ... },
  "workspace": { "workspace_id": "..." },
  "document": {
    "workspace_id": "...",
    "path": ".reffy/manifest.json",
    "document_kind": "manifest",
    "content_type": "application/json",
    "metadata": {},
    "created_at": 1777059619,
    "updated_at": 1777059619,
    "content": "..."
  }
}
```

List response (when `path` is absent):
```json
{
  "source": { ... },
  "workspace": { "workspace_id": "..." },
  "documents": [ { "workspace_id": "...", "path": "...", ... } ]
}
```

When `include_content=false`, the `content` field is omitted from each document object.

### GET /workspaces/{workspace_id}/snapshot
Full export of all documents in the projection. Accepts optional `prefix` query param.

Response:
```json
{
  "source": { ... },
  "workspace": { "workspace_id": "..." },
  "generated_at": 1777059619,
  "documents": [ { ... full document objects with content ... } ]
}
```

### POST /workspaces/{workspace_id}/import
Bulk import documents. This is the canonical CLI push path.

Request body:
```json
{
  "replace_missing": true,
  "documents": [
    {
      "path": ".reffy/manifest.json",
      "content": "{}",
      "content_type": "application/json",
      "document_kind": "manifest",
      "metadata": {}
    }
  ]
}
```

- `replace_missing: true` prunes documents **only within this workspace_id** that are not in the import set.
- `document_kind` and `content_type` are optional; inferred from path when omitted.
- `metadata` is optional.

Response:
```json
{
  "source": { ... },
  "workspace": { "workspace_id": "..." },
  "imported": 42,
  "created": 10,
  "updated": 30,
  "deleted": 2,
  "created_paths": ["..."],
  "updated_paths": ["..."],
  "deleted_paths": ["..."]
}
```

### PUT /workspaces/{workspace_id}/documents
Upsert a single document. Requires a file lock.

Request body:
```json
{
  "path": ".reffy/artifacts/foo.md",
  "content": "...",
  "content_type": "text/markdown",
  "document_kind": "artifact",
  "metadata": {},
  "lock_id": "uuid-of-active-lock"
}
```

Response includes the full document object under a `document` key.

### DELETE /workspaces/{workspace_id}/documents
Delete a single document. Requires a file lock.

Request body:
```json
{
  "path": ".reffy/artifacts/foo.md",
  "lock_id": "uuid-of-active-lock"
}
```

Response: `{ "deleted": true, "workspace_id": "...", "path": "..." }`

### POST /workspaces/{workspace_id}/locks
Acquire a file lock scoped to `(workspace_id, path)`.

Request body:
```json
{
  "path": ".reffy/artifacts/foo.md",
  "owner": "optional-owner-id",
  "ttl_seconds": 60
}
```

- `ttl_seconds` defaults to 60, max 3600.
- If the same `owner` already holds the lock, it is reused (`"reused": true`).

Response:
```json
{
  "lock": {
    "workspace_id": "...",
    "path": "...",
    "lock_id": "uuid",
    "owner": "optional-owner-id",
    "created_at": 1777059619,
    "expires_at": 1777059679
  }
}
```

Conflict (409): `{ "error": "lock_conflict", "message": "path is already locked", "lock": { ... } }`

### DELETE /workspaces/{workspace_id}/locks/{lock_id}
Release a lock.

Response: `{ "released": true, "workspace_id": "...", "lock_id": "...", "path": "..." }`

## Key Differences from v1
| Concern | v1 | v2 |
|---|---|---|
| Identity | `workspace_name` (singular) | `project_id` + `workspace_id` (projection) |
| Route prefix | `/workspace/...` | `/workspaces/{workspace_id}/...` |
| Storage key | `path` | `(workspace_id, path)` |
| Multi-workspace | No | Yes — one actor holds many projections |
| Projection listing | N/A | `GET /workspaces` |
| Lock isolation | Per path | Per `(workspace_id, path)` |

## Actor Config Shape
```typescript
{
  actorType: "reffyRemoteBackend",
  version: "v2",
  params: {
    project_id: string,          // required — stable source identity
    workspace_ids?: string[],    // optional — allow-list; omit for lazy creation
    default_lock_ttl_seconds?: number,   // default 60
    max_snapshot_documents?: number,     // default 1000
  }
}
```
/
## Implementation Files
- Handler: `src/handlers/reffyRemoteBackend.ts` (v2 factory at `reffyRemoteBackendV2HandlerFactory`)
- Types: `src/types.ts` (`ReffyRemoteBackendV2ActorConfig`)
- Registry: `src/registry.ts`
- Tests: `test/pod.spec.ts`
