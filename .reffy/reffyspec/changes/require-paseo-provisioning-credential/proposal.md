# Change: Send Paseo provisioning credential on manager creation

## Why
paseo-core is about to require a deployment provisioning credential (the Worker secret `PASEO_PROVISIONING_TOKEN`, held by the Paseo operator) on actor creation (`POST /pods/{pod}/actors`). `reffy remote init --provision` is the only Reffy code path that creates an actor, and it currently sends that request with no `Authorization` header. Once paseo-core deploys `require-provisioning-credential`, fresh provisioning breaks with an unexplained `401`, and the existing generic `401` hint points the operator at the wrong credential (`PASEO_TOKEN`).

paseo-core has asked for this change to ship in a Reffy release **before** their deploy (their change `require-provisioning-credential`, task 3.3). Sending a bearer that today's Paseo ignores is harmless, so the release is safe to ship ahead of the backend change.

## What Changes
- Resolve `PASEO_PROVISIONING_TOKEN` from environment configuration (shell, auto-loaded `.env`, or `--env-file`; exported shell variables win), trimmed and never persisted.
- Require it only when `reffy remote init --provision` will create a manager actor; fail fast before any network request when it is missing. Joining an existing manager (`--manager-pod` + `--manager-actor`, or a saved manager identity) never requires it.
- Send it as `Authorization: Bearer <provisioning token>` on `POST /pods/{pod}/actors` and on no other request. `POST /pods` stays unauthenticated.
- Never fall back between `PASEO_TOKEN` and `PASEO_PROVISIONING_TOKEN` in either direction.
- Map actor-creation failures to provisioning-specific hints: `401` names `PASEO_PROVISIONING_TOKEN`; `503` with `error.code === "provisioning_not_configured"` tells the operator to configure the Worker secret. Both take precedence over the generic `PASEO_TOKEN` `401` hint.
- Document the new variable in the managed `sync-remote` skill and the README remote setup section.

## Impact
- Affected specs: `remote-workspace-manager`
- Affected code: `src/remote.ts` (`PaseoManagerClient.createManagerActor`, `ensureManagerInit`), `src/cli.ts` (credential resolver, `remote init` handler, `decorateRemoteError`), `src/skills.ts` (managed `sync-remote` skill body), `README.md`, `test/remote.test.ts`, `test/cli.integration.test.ts`
- Compatibility: no change for existing workspaces or any remote command other than `reffy remote init --provision`. Operators who provision fresh managers must obtain `PASEO_PROVISIONING_TOKEN` from the Paseo operator.
- Release: target v1.9.5; report the released version back to paseo-core `require-provisioning-credential` task 3.3 so their deploy can proceed.

## Supersedes
None

## Reffy References
- `paseo-provisioning-credential-handoff.md` - paseo-core handoff describing the backend contract change, required CLI behavior, security rules, test list, and rollout order (mirrored from `nuveris-v1/paseo-core`)
