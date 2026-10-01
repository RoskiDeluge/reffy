## 1. Implementation
- [x] 1.1 `src/remote.ts`: add a `provisioningToken` parameter to `PaseoManagerClient.createManagerActor` and send it via the `http()` `token` option; leave `createPod` unauthenticated.
- [x] 1.2 `src/remote.ts`: add `provisioningToken` to `EnsureManagerInitOptions`, pass it to `createManagerActor`, and throw before the request if the create-actor branch runs without it; update the stale "do not require a bearer token" comment.
- [x] 1.3 `src/cli.ts`: add `resolvePaseoProvisioningToken({ required })` beside `resolvePaseoToken` (env, trimmed, never persisted, no fallback to/from `PASEO_TOKEN`) with the fail-fast message naming the Paseo operator and `.env`.
- [x] 1.4 `src/cli.ts`: in the `remote init` handler, resolve the provisioning credential as required exactly when `willMintToken` is true and pass it to `ensureManagerInit`; never pass it otherwise.
- [x] 1.5 `src/cli.ts`: in `decorateRemoteError`, handle actor-creation `401` and `503 provisioning_not_configured` (tolerant JSON parse of `httpError.body`) before the generic `401` hint.
- [x] 1.6 `src/skills.ts`: add `PASEO_PROVISIONING_TOKEN` to the `sync-remote` skill "Required environment" section (only for `init --provision`, held by the Paseo operator, never persisted); refresh the managed `.reffy/skills/sync-remote/SKILL.md`.
- [x] 1.7 `README.md`: document `PASEO_PROVISIONING_TOKEN` in the remote setup section and correct the claim that every Paseo request carries `PASEO_TOKEN`.

## 2. Tests
- [x] 2.1 `createManagerActor` sends `Authorization: Bearer <provisioning token>` (mocked `fetch`).
- [x] 2.2 `createPod` sends no `Authorization` header.
- [x] 2.3 `init --provision` without `PASEO_PROVISIONING_TOKEN` fails before any request, with the provisioning message.
- [x] 2.4 `init --manager-pod --manager-actor` (no `--provision`) succeeds without `PASEO_PROVISIONING_TOKEN` and never sends it.
- [x] 2.5 A `401` from actor creation yields the provisioning hint, not the `PASEO_TOKEN` hint.
- [x] 2.6 A `503 provisioning_not_configured` from actor creation yields the operator hint.
- [x] 2.7 After a successful provision, `.reffy/state/remote.json` does not contain the provisioning credential.
- [x] 2.8 The provisioning credential is not sent on `POST /pods` or on any manager/backend request made during the same `init` run.

## 3. Verification and release
- [x] 3.1 Run `pnpm build`, `pnpm check`, and `pnpm test`.
- [x] 3.2 Run `reffy plan validate require-paseo-provisioning-credential`.
- [ ] 3.3 Release v1.9.5 and report the version back to paseo-core `require-provisioning-credential` task 3.3.
- [ ] 3.4 After paseo-core deploys, verify `reffy remote init --provision` against a scratch workspace id succeeds with the credential and fails with the provisioning hint without it.
