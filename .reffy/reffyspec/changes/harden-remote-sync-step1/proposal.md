# Change: Harden remote sync step 1 workflow

## Why
Reffy now has a working step-1 remote sync flow against Paseo. The next risk is not missing functionality but insufficient hardening. A remote workflow becomes product surface only when it is deterministic under normal use, explicit under failure, and inspectable enough that users can debug it without dropping to curl or ad hoc backend knowledge.

The current implementation crosses the important MVP boundary, but there is still a gap between "works" and "trustworthy." This change is about closing that gap for step 1 before moving on to cross-project retrieval and planning features.

## What Changes
- Harden `reffy remote init` so saved linkage, provisioning behavior, and text/json output are deterministic and easy to reason about.
- Harden `reffy remote status` so it clearly reports:
  - local identity
  - remote identity
  - saved linkage
  - reachability
  - remote document counts and relevant summary metadata
- Harden `reffy remote push` so the default "remote reflects local" behavior is explicit, verified, and clearly documented.
- Confirm and specify prune semantics for step 1:
  - remote documents missing from local are removed by default
  - results are surfaced in created/updated/deleted/imported counts
- Improve failure messaging for:
  - missing manifest identity
  - missing linkage
  - unreachable endpoint
  - provisioning failure
  - identity mismatch
  - malformed or partial import responses
- Confirm that `reffy remote ls` and `reffy remote cat` are sufficient for routine debugging of remote state without direct backend API calls.
- Tighten docs for the step-1 contract, especially that `PASEO_ENDPOINT` is the only required env var for the fresh-provision path.

## Scope
Included:
- step-1 behavior hardening for the existing Paseo-backed remote workflow
- improved diagnostics, status reporting, and failure clarity
- explicit prune/import verification semantics
- docs and tests that support operational trust

Excluded:
- new cross-project retrieval flows
- dependency metadata
- discovery or registry features for finding multiple remote backends
- bidirectional sync
- merge or conflict resolution
- broad backend abstraction work

## Impact
- Affected specs:
  - `remote-sync-snapshot-publication`
- Affected code:
  - `src/cli.ts`
  - `src/remote.ts`
  - `scripts/reffy-remote-backend-demo.mjs`
  - `README.md`
  - remote-related tests

## Reffy References
- `reffy-cli-step1-mvp.md` - defines the desired trust posture for step 1: deterministic behavior, explicit failure, inspectability, and verification as a first-class concern.
- `adding-helper-script-for-paseo-deploy.md` - clarifies the helper-script ownership boundary and the minimal env setup expected for the Reffy-owned Paseo connection flow.
