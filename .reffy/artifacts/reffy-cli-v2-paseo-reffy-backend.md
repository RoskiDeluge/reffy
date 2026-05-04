# Reffy CLI Integration for Workspace Manager v1 and Backend v2

## Why this artifact
This note describes the current live contract that Reffy CLI should target in order to work with:

- `reffyWorkspaceManager.v1`
- `reffyRemoteBackend.v2`

This is not a future-looking design note.

It is a practical integration handoff for the current `paseo` implementation.

## Current backend shape
The current remote model is:

- one `reffyWorkspaceManager.v1` actor acts as the control-plane manager
- one `reffyRemoteBackend.v2` actor represents one shared `workspace_id`
- each local project pushes into that workspace under its own `project_id`

The CLI should treat these as two separate remote surfaces:

- manager actor for create/list/resolve/register
- workspace container actor for import/read/locks

## Required local inputs
The CLI should assume it has, or can derive:

- `project_id` from local `.reffy/manifest.json`
- one selected `workspace_id`
- `PASEO_ENDPOINT`
- manager actor identity:
  - `pod_name`
  - `manager_actor_id`

The CLI should not assume that the workspace backend actor id is already known locally. It should resolve that through the manager.

## Expected local state shape
The CLI should store remote linkage in a way that preserves:

- endpoint
- manager actor identity
- workspace backend actor identity per selected workspace

A practical shape is:

```json
{
  "version": 3,
  "provider": "paseo",
  "endpoint": "https://paseo-core.paseo.workers.dev",
  "manager": {
    "pod_name": "pod-id",
    "actor_id": "manager-actor-id"
  },
  "targets": {
    "workspace-id": {
      "workspace_backend": {
        "pod_name": "pod-id",
        "actor_id": "workspace-actor-id"
      },
      "last_imported_at": "2026-05-03T00:00:00.000Z"
    }
  }
}
```

The important distinction is:

- manager identity is global to the CLI session or repo linkage
- workspace backend identity is per `workspace_id`

## Manager actor API

### Create workspace
Create a shared workspace and provision its backend actor:

`POST /pods/{pod}/actors/{manager_actor_id}/workspaces`

Payload:

```json
{
  "workspace_id": "shared-planning",
  "metadata": {
    "label": "Shared planning"
  },
  "controller": {
    "client": "reffy-cli-mvp"
  }
}
```

Response includes:

- `workspace.workspace_id`
- `workspace.backend.pod_name`
- `workspace.backend.actor_id`

### Get workspace
Resolve a workspace and its backend actor:

`GET /pods/{pod}/actors/{manager_actor_id}/workspaces/{workspace_id}`

The CLI should use this when:

- the workspace may already exist
- it needs to recover backend actor identity

### Register project in workspace
Register a project before import:

`POST /pods/{pod}/actors/{manager_actor_id}/workspaces/{workspace_id}/projects/{project_id}`

Payload:

```json
{
  "owner": {
    "source": "paseo-core"
  },
  "metadata": {
    "source": "reffy-cli"
  }
}
```

The CLI should do this before first push into a workspace.

### List projects
Inspect currently registered projects:

`GET /pods/{pod}/actors/{manager_actor_id}/workspaces/{workspace_id}/projects`

### Get one project registration
Inspect one registration:

`GET /pods/{pod}/actors/{manager_actor_id}/workspaces/{workspace_id}/projects/{project_id}`

## Workspace backend actor API

Assume the workspace backend actor base is:

`/pods/{pod}/actors/{workspace_actor_id}`

### Workspace summary
`GET /workspace`

Returns:

- workspace metadata
- registered project counts
- source contribution summaries
- workspace-owned document counts

### List registered projects
`GET /workspace/projects`

### Get one project summary
`GET /workspace/projects/{project_id}`

### Import one local `.reffy/` tree
`POST /workspace/projects/{project_id}/import`

Payload:

```json
{
  "replace_missing": true,
  "documents": [
    {
      "path": ".reffy/manifest.json",
      "content": "{...}",
      "content_type": "application/json",
      "metadata": {
        "source": "local-reffy-import",
        "size_bytes": 123
      }
    }
  ]
}
```

Behavior:

- updates only that `project_id`
- `replace_missing=true` prunes only that `project_id`
- does not touch workspace-owned documents
- does not touch other projects' contributions

### Read one source-owned document
`GET /workspace/projects/{project_id}/documents?path=.reffy%2Fmanifest.json`

### List source-owned documents
`GET /workspace/projects/{project_id}/documents`

Supported query params:

- `path`
- `prefix`
- `document_kind`
- `include_content`
- `limit`

### Snapshot one source contribution
`GET /workspace/projects/{project_id}/snapshot`

### Workspace-owned document routes
These are for controller-style shared documents, not normal local source push:

- `GET /workspace/documents`
- `PUT /workspace/documents`
- `DELETE /workspace/documents`

The CLI does not need these for initial local source push unless it also wants to manage shared workspace notes.

## Lock API
The backend uses one lock endpoint with a discriminated payload:

`POST /workspace/locks`

### Source-owned lock

```json
{
  "lock_domain": "source_owned",
  "project_id": "paseo-core",
  "path": ".reffy/artifacts/foo.md",
  "owner": "reffy-cli",
  "ttl_seconds": 120
}
```

### Workspace-owned lock

```json
{
  "lock_domain": "workspace_owned",
  "path": ".reffy/artifacts/workspace_note.md",
  "owner": "reffy-cli",
  "ttl_seconds": 120
}
```

Release:

`DELETE /workspace/locks/{lock_id}`

For initial CLI source push, lock management is not required because source import uses the bulk import endpoint rather than path-by-path mutation. Locks matter only if the CLI starts doing direct document edits.

## Recommended CLI flow

### 1. Workspace create
If user asks to create a workspace:
1. ensure manager actor identity is configured
2. `POST /workspaces`
3. store returned workspace backend actor identity locally under `workspace_id`

### 2. Workspace resolve
If workspace may already exist:
1. `GET /workspaces/{workspace_id}`
2. refresh stored workspace backend actor identity

### 3. Project registration
Before first push into a workspace:
1. `POST /workspaces/{workspace_id}/projects/{project_id}`

This can be safely retried if the implementation remains idempotent in practice.

### 4. Source push
Push the local `.reffy/` tree:
1. collect local `.reffy/` files
2. normalize each file into:
   - `path`
   - `content`
   - `content_type`
   - optional metadata
3. `POST /workspace/projects/{project_id}/import`
4. record `last_imported_at`

### 5. Status and readback
For status commands, the CLI should prefer:

- manager route when it needs workspace resolution or registration state
- workspace actor route when it needs actual document or snapshot state

## Error expectations
The CLI should be prepared for:

- `404` when workspace or project does not exist
- `409` for:
  - duplicate workspace creation
  - unregistered project import
  - lock conflicts
- `400` for invalid `workspace_id`, `project_id`, or path payloads

The most important behavioral case is:

- importing before registration should be treated as a backend contract violation

So the CLI should register first rather than relying on implicit backend creation.

## Important conventions

### 1. `workspace_id` is actor identity
The CLI should not think of `workspace_id` as a projection inside one project actor anymore.

### 2. `project_id` is contribution identity
Each local repo pushes as one contribution namespace inside the shared workspace.

### 3. Local `.reffy/` remains source of truth
The CLI should assume:

- remote backends are derivative
- old backends can be abandoned
- fresh manager/backend actors can be provisioned and repopulated from local state

### 4. Reffy CLI is the first control-plane client
The CLI should lean into the manager + workspace backend split rather than trying to talk only to the storage actor.

## Main judgment
The correct integration model for Reffy CLI is:

- manager actor for workspace lifecycle and project registration
- workspace backend actor for project import and workspace reads

That is the current live contract in `paseo`, and the CLI should align to it directly rather than trying to preserve the older projection-based backend shape.
