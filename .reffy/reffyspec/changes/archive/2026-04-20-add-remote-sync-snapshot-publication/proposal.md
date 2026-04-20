# Change: Add remote sync snapshot publication

## Why
Reffy now has a clear ideation path for making the local `.reffy/` workspace publishable to a remote backend for cross-project sharing and inspection. What is missing is a concrete product and runtime contract for that path.

Without a spec, remote support risks becoming a loose collection of ad hoc commands and transport details. That would undermine the main value of step 1, which is to make the local workspace and the remote representation behave like one coherent, inspectable system under explicit rules.

This change formalizes the first remote sync capability as one-way snapshot publication from local `.reffy/` to a linked remote workspace, with clear identity, path normalization, and verification behavior.

## What Changes
- Add a new `reffy remote` command group with a narrow step-1 surface:
  - `reffy remote init`
  - `reffy remote status`
  - `reffy remote push`
  - `reffy remote ls`
  - `reffy remote cat <path>`
- Define manifest-backed workspace identity as the required local source for remote sync:
  - `project_id`
  - `workspace_name`
- Introduce a Reffy-managed remote linkage file separate from `.reffy/manifest.json` to store Paseo connection details:
  - `endpoint`
  - `pod_name`
  - `actor_id`
  - optional local state such as last import metadata
- Treat the first implementation as Paseo-targeted rather than backend-agnostic:
  - remote initialization can connect to an existing Paseo actor or provision one explicitly
  - Reffy targets the current `reffyRemoteBackend` actor contract
- Add a Reffy-owned helper script path as the first integration milestone:
  - the helper script lives in the Reffy repo
  - it reads identity from `.reffy/manifest.json`
  - it provisions or links a Paseo actor and imports the local workspace
  - it serves as the bridge before or alongside full `reffy remote` command support
- Define remote push as deterministic full-workspace import of the local `.reffy/` tree via Paseo `workspace/import`.
- Define canonical remote document paths as rooted `.reffy/...` workspace paths, matching the current Paseo backend contract.
- Require status and push flows to verify manifest identity against the linked Paseo workspace summary.
- Keep step 1 explicitly one-way:
  - local to remote publication
  - remote inspection
  - no pull
  - no merge
  - no conflict resolution

## Scope
This proposal is intentionally limited to the first usable remote sync substrate.

Included:
- CLI UX and validation rules for remote linkage and publication
- Local config/state shape for Paseo connection metadata
- Paseo actor provisioning and linkage expectations
- Workspace import and inspection payload expectations
- Human-auditable status and inspection behavior
- A Reffy-owned helper-script path for deployment and contract verification

Excluded:
- bidirectional sync
- remote-to-local writes
- semantic search
- partial sync defaults
- diff-aware merge or reconciliation
- multi-backend abstraction beyond the first Paseo-targeted implementation
- scoped sharing and auth policy design beyond basic linkage requirements
- deployment or update of Paseo Worker infrastructure itself

## Impact
- Affected specs: `remote-sync-snapshot-publication`
- Affected code:
  - `src/cli.ts`
  - `src/storage.ts`
  - `src/types.ts`
  - `src/manifest.ts`
  - new remote runtime/config modules such as `src/remote.ts` and `src/remote-config.ts`
  - `scripts/reffy-remote-backend-demo.mjs` or a successor helper script used to de-risk deployment and contract validation
  - `README.md`

## Reffy References
- `reffy-cli-step1-mvp.md` - defines the desired step-1 CLI surface, trust model, and explicit failure posture for remote workspace publication.
- `reffy-remote-sync-direction.md` - defines the recommended snapshot-based sync contract, path normalization rules, and the split between manifest identity and remote linkage state.
- `adding-helper-script-for-paseo-deploy.md` - clarifies that the manifest-aware deploy/import flow belongs in Reffy, recommends `.env`-driven Paseo linkage for the helper path, and keeps Worker infrastructure ownership on the Paseo side.
