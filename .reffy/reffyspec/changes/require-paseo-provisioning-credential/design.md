## Context
paseo-core is gating actor creation (`POST /pods/{pod}/actors`) behind a deployment provisioning credential, `PASEO_PROVISIONING_TOKEN`. It is a different credential from the manager token (`PASEO_TOKEN`) with a different holder: the Paseo operator holds the provisioning credential; the manager actor mints the manager token. Paseo rejects a manager token for creation and a provisioning token on manager routes.

Backend responses on the creation route after the paseo-core deploy:
- Missing or wrong bearer: `401 Unauthorized`, plain text, no detail.
- Deployment has no provisioning credential configured: `503` with `{ "ok": false, "error": { "code": "provisioning_not_configured", ... } }`.

`POST /pods` (pod name minting) stays open. Every other route the CLI calls keeps using `PASEO_TOKEN`.

### Problem Summary
- `createManagerActor` sends no `Authorization` header, so `reffy remote init --provision` will fail once paseo-core deploys.
- `decorateRemoteError` maps every `401` to a `PASEO_TOKEN` hint, which would misdirect an operator on a creation failure.

## Goals / Non-Goals
- Goals:
  - Fresh provisioning keeps working against the gated backend when the operator supplies the provisioning credential.
  - Missing or rejected provisioning credentials produce errors that name the right credential and the right holder.
  - The provisioning credential is confined to the single request that needs it and never touches disk or logs.
- Non-Goals:
  - Changing workspace, project, push, ls, cat, snapshot, or token-rotation flows.
  - Provisioning anything beyond the manager actor; workspace backends are provisioned by the manager.
  - Changing one-time issuance of the minted manager token.

## Decisions
- Decision: Pass the provisioning credential explicitly as a `createManagerActor(podName, provisioningToken)` argument and through `EnsureManagerInitOptions`, using the existing `http()` `token` option.
  - Rationale: Keeps the credential out of `PaseoManagerClient`'s constructor-level token, so it cannot leak onto other requests made by the same client instance.
- Decision: Require the credential using the existing `willMintToken` condition in the `remote init` handler (provision requested and no manager actor id from flags, `PASEO_MANAGER_ACTOR`, or saved config).
  - Rationale: That condition already defines exactly when actor creation happens; reusing it keeps "requires `PASEO_TOKEN`" and "requires `PASEO_PROVISIONING_TOKEN`" mutually exclusive and checked before any network call.
- Decision: `ensureManagerInit` also throws if it reaches the create-actor branch without a provisioning credential.
  - Rationale: Defense in depth for library callers that bypass the CLI handler; still fails before the creation request.
- Decision: Add a `resolvePaseoProvisioningToken({ required })` helper beside `resolvePaseoToken` with identical env/trim/no-persist rules, and no cross-variable fallback.
  - Rationale: The `.env` loader already populates `process.env` with shell precedence, so mirroring the existing resolver keeps behavior uniform.
- Decision: In `decorateRemoteError`, match actor-creation requests by pathname `^/pods/[^/]+/actors/?$` (nothing after `actors`) and handle `401` and `503 provisioning_not_configured` there before the generic `401` branch. Parse `httpError.body` as JSON tolerantly; a non-JSON `503` falls through to the fallback message.
  - Rationale: The path shape uniquely identifies creation; manager routes always have an actor id segment after `actors`.
- Decision: Update the stale comment in `ensureManagerInit` ("createPod and createManagerActor do not require a bearer token") to say only `createPod` is unauthenticated.

## Reffy Inputs
- paseo-provisioning-credential-handoff.md

## Open Questions
- None. Rollout order and release target (v1.9.5) are fixed by the paseo-core handoff.
