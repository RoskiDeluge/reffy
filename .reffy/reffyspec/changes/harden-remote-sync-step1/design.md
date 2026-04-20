## Context
The first remote sync implementation is live and works against Paseo. That changes the engineering question from "how do we make remote exist?" to "what must be true for step 1 to be trustworthy enough to build on?"

Step 1 is the substrate for later cross-project planning features. If the basic init/status/push/inspect workflow is ambiguous or hard to debug, every later layer inherits that instability.

### Problem Summary
- The step-1 command surface exists, but the remaining work is hardening and explicitness rather than net-new capability.
- Status and push output need to be strong enough that a user can understand remote state without backend-specific knowledge.
- Failure behavior needs to be narrow, actionable, and consistent.
- The docs should encode the real contract: only `PASEO_ENDPOINT` is required for the fresh-provision path, while other linkage details become saved local state after init.

## Goals / Non-Goals
- Goals:
  - Make step-1 remote behavior deterministic and inspectable.
  - Make status output sufficient for routine diagnosis.
  - Make push semantics and prune behavior explicit.
  - Make failure messaging strong enough that users do not need curl to understand what went wrong.
  - Keep the docs aligned with the actual minimal connection model.
- Non-Goals:
  - Introduce discovery across multiple backends.
  - Add new retrieval or dependency features.
  - Change the one-way nature of step 1.

## Decisions
- Decision: This change modifies the existing `remote-sync-snapshot-publication` capability rather than introducing a new capability.
  - Rationale: The work is step-1 hardening of the same product surface, not a separate feature area.

- Decision: Hardening work should prioritize operator clarity over implementation cleverness.
  - Rationale: Step 1 succeeds when users can see identity, linkage, remote counts, and failure causes directly in CLI output.

- Decision: The saved linkage file remains local-only state.
  - Rationale: Hardening should improve the visibility and use of `.reffy/state/remote.json`, not move it into the synced workspace contract.

- Decision: The minimal setup story remains `PASEO_ENDPOINT` for the fresh-provision path.
  - Rationale: That is the cleanest connection model and should stay obvious in docs and CLI behavior.

## Hardening Focus Areas
### `remote init`
- deterministic output for both "created new linkage" and "recorded existing linkage"
- explicit statement of whether pod/actor were created or reused
- consistent saved-config path and identity reporting

### `remote status`
- clear separation of:
  - saved linkage
  - local identity
  - remote identity
  - reachability
  - remote counts
- useful error text when linkage is missing or the remote endpoint is unreachable

### `remote push`
- explicit default that remote reflects local
- clear created/updated/deleted/imported counts
- verified identity match before reporting success
- explicit failure if the backend response is partial or malformed

### `remote ls` and `remote cat`
- enough inspection quality that users can debug remote state without reaching for raw API calls
- clear path validation and missing-path errors

## Testing Notes
The hardening pass should increase confidence in behavior, not only code coverage.
Useful verification targets:
- provisioned and existing-linkage init paths
- unreachable endpoint handling
- missing/invalid linkage state
- identity mismatch surfaced by status and push
- visible delete/prune reporting
- docs/examples that match the actual runtime behavior

## Reffy Inputs
- `reffy-cli-step1-mvp.md`
- `adding-helper-script-for-paseo-deploy.md`

## Open Questions
- Should `remote status` explicitly mark whether the current linkage came from saved config versus transient CLI/env overrides?
- Should `remote push` show a stronger textual statement that prune is active by default, or is count reporting sufficient?
