## Context
Reffy currently operates as a deterministic local workspace and planning runtime. The proposed remote capability changes that boundary: `.reffy/` content can now be published to an external backend and inspected there.

The design constraint is to add that capability without turning Reffy into a general-purpose sync engine. Step 1 must preserve the local-first model and keep failure handling auditable.

### Problem Summary
- Reffy lacks a first-class remote workspace publication flow.
- The manifest now carries workspace identity, but there is no approved model for Paseo connection metadata, deployment linkage, remote path shape, or status verification.
- The current concrete backend contract is the Paseo `reffyRemoteBackend` actor rather than a generic snapshot API.
- A naive or overly abstract implementation would drift away from the contract Reffy actually has to integrate with now.
- The new helper-script note also clarifies an ownership boundary: manifest-aware actor creation and workspace import belong in Reffy, while Worker infrastructure deployment remains a Paseo concern.

## Goals / Non-Goals
- Goals:
  - Add a narrow remote CLI surface that is deterministic and inspectable.
  - Keep workspace identity in `.reffy/manifest.json`.
  - Store Paseo linkage separately from committed workspace identity.
  - Treat push as full-workspace import of the local `.reffy/` tree.
  - Normalize all remote paths to the `.reffy/...` namespace required by the current backend.
  - Expose enough workspace metadata for users to verify local and remote alignment.
  - Provide a Reffy-owned helper-script path to provision or validate the Paseo actor contract before the full native CLI is complete.
- Non-Goals:
  - Bidirectional sync.
  - Merge or conflict resolution.
  - Partial or selective sync as the default behavior.
  - Search, retrieval ranking, or agent-aware context selection.
  - Designing a backend-neutral abstraction before the Paseo integration works reliably.

## Decisions
- Decision: Step 1 uses one-way snapshot publication, not collaborative filesystem sync.
  - Rationale: This preserves a small mental model and makes failure cases more explicit.

- Decision: Manifest identity and remote linkage remain separate.
  - Rationale: `project_id` and `workspace_name` belong to the workspace and should remain repo-visible. Paseo endpoint, pod, actor, and deployment linkage are environment-specific and should not pollute the manifest contract.

- Decision: The first implementation should target the existing Paseo actor contract directly.
  - Rationale: The repo already contains a working demo path against concrete Paseo endpoints:
    - `POST /pods`
    - `POST /pods/:pod/actors`
    - `GET /workspace`
    - `POST /workspace/import`
    - `GET /workspace/snapshot`
    - `GET /workspace/documents?path=...`
  Building around that contract is lower risk than inventing a generic remote interface first.

- Decision: Remote linkage should live in a Reffy-managed file under `.reffy/`.
  - Rationale: Reffy already owns workspace-local runtime files. A dedicated file keeps the deployment boundary explicit and easier to extend.

- Decision: Remote payloads should use normalized `.reffy/...` workspace paths, not bare relative paths.
  - Rationale: The existing Paseo actor contract and helper script already operate on canonical workspace paths like `.reffy/manifest.json`.

- Decision: A helper deployment/integration script is part of the implementation plan, not an incidental dev-only artifact.
  - Rationale: The helper-script note makes the ownership boundary explicit. Because the script reads `.reffy/manifest.json` and performs a Reffy workflow, it belongs in Reffy rather than being left as project-by-project glue code.

- Decision: `.env`-driven local execution is acceptable for the helper-script phase.
  - Rationale: The current integration path depends on values like `PASEO_ENDPOINT`, optional `PASEO_POD_NAME`, and optional `PASEO_ACTOR_ID`. Reffy can support this helper workflow without treating `.env` loading itself as the long-term product boundary.

- Decision: Reffy may provision or link actors, but it does not own deployment of Paseo Worker infrastructure.
  - Rationale: This preserves a clean system boundary. Reffy owns manifest-driven remote workflow; Paseo owns backend runtime infrastructure.

## Proposed Local State
### Manifest
`.reffy/manifest.json` remains the source of:
- `project_id`
- `workspace_name`

### Remote linkage file
Recommended location:
- `.reffy/state/remote.json`

Suggested shape:

```json
{
  "version": 1,
  "provider": "paseo",
  "endpoint": "https://example.invalid",
  "pod_name": "pod_123",
  "actor_id": "actor_456",
  "last_imported_at": "2026-04-19T00:00:00.000Z"
}
```

Notes:
- `provider` keeps the file explicit even if only Paseo is supported at first.
- `pod_name` and `actor_id` reflect the current Paseo contract more accurately than a generic workspace id.
- import metadata is optional local cache/state and should not be treated as the source of truth.

## Proposed Paseo Model
The first implementation should map Reffy behavior to the current Paseo actor endpoints:

1. Provisioning and linkage
   - `POST /pods`
   - `POST /pods/:pod/actors`
   - actor type `reffyRemoteBackend`
   - actor params include `project_id` and `workspace_name`

2. Workspace summary
   - `GET /workspace`
   - used by `reffy remote status`

3. Full import
   - `POST /workspace/import`
   - accepts the full document set and `replace_missing`

4. Snapshot listing
   - `GET /workspace/snapshot`
   - used by `reffy remote ls`

5. Document inspection
   - `GET /workspace/documents?path=...`
   - used by `reffy remote cat`

The design should stay conceptually snapshot-oriented, but the concrete implementation should follow the actual Paseo contract rather than assuming revision ids already exist.

## Command Behavior
### `reffy remote init`
- Reads `project_id` and `workspace_name` from `.reffy/manifest.json`
- Validates that both are present for identity-aware remote workflows
- Either:
  - connects to an existing Paseo pod/actor
  - or explicitly provisions a pod and `reffyRemoteBackend` actor
- Writes Paseo linkage config without mutating the manifest
- Does not push content by default
- Does not silently provision infrastructure unless the command explicitly opts into deployment behavior

### `reffy remote status`
- Reads local identity and linkage config
- Reports whether remote connectivity is available
- Calls Paseo `GET /workspace`
- Shows remote workspace identity and workspace summary metadata when reachable
- Fails clearly on identity mismatch or invalid linkage config

### `reffy remote push`
- Scans the full local `.reffy/` tree
- Produces deterministic canonical paths rooted at `.reffy/`
- Publishes a full import via Paseo `POST /workspace/import`
- Treats the remote as a reflection of local by default
- Verifies returned import metadata and workspace identity before reporting success

### `reffy remote ls`
- Lists remote document paths via Paseo `GET /workspace/snapshot`
- Optimized for inspection rather than synchronization decisions

### `reffy remote cat <path>`
- Reads one remote document via Paseo `GET /workspace/documents?path=...`
- Fails clearly if the document is absent

## Helper Script Role
The current `scripts/reffy-remote-backend-demo.mjs` establishes the concrete contract Reffy needs to honor:
- reads manifest identity
- provisions pod and actor when needed
- imports `.reffy/` documents
- inspects workspace, snapshot, and manifest documents

The implementation plan should either evolve this script into a supported helper or replace it with a more intentional helper entrypoint in Reffy itself. In either case:
- the helper is Reffy-owned rather than project-local glue
- `.env`-driven execution is acceptable for the bridge phase
- the helper should not be responsible for deploying the underlying Paseo Worker infrastructure
- this path should be used to de-risk the integration before the native CLI is considered done

## Failure Model
The CLI should return actionable errors when:
- `.reffy/manifest.json` is missing or invalid
- `project_id` or `workspace_name` is missing
- Paseo linkage config is missing or malformed
- the Paseo endpoint is unreachable
- remote workspace identity does not match local manifest identity
- Paseo actor provisioning fails
- the import response is incomplete or missing expected counts
- a requested remote path is not in canonical `.reffy/...` form or is not found

## Testing Notes
The first implementation should emphasize:
- config parsing tests
- `.reffy/...` path normalization tests
- CLI validation tests
- Paseo response contract tests with mocked transport
- helper script smoke coverage where practical

Avoid starting with live integration tests as the only safety net. The core logic should be testable without depending on the external backend.

## Reffy Inputs
- `reffy-cli-step1-mvp.md`
- `reffy-remote-sync-direction.md`
- `adding-helper-script-for-paseo-deploy.md`

## Open Questions
- Should the initial implementation use `.reffy/state/remote.json` or `.reffy/remote.json`?
- Should provisioning live inside `reffy remote init`, or should Reffy keep a dedicated helper-script-first flow for creating the Paseo pod and actor?
- How much of the Paseo workspace summary should be exposed in text output versus JSON output in the first pass?
