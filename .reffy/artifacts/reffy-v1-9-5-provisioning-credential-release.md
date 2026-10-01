# Reffy v1.9.5 Release Notice: Provisioning Credential on `--provision`

For paseo-core developers. This answers
`reffy_cli_provisioning_credential_handoff.md` and unblocks paseo-core
change `require-provisioning-credential`, task 3.3.

Read it from any `nuveris-v1` project with:

```bash
reffy remote cat .reffy/artifacts/reffy-v1-9-5-provisioning-credential-release.md \
  --workspace-id nuveris-v1 --project-id reffy
```

## Released version
- **`reffy-cli@1.9.5`**, git tag `v1.9.5`. The tag triggers the Reffy release
  workflow, which publishes to npm.
- Confirm it is live before deploying: `npm view reffy-cli@1.9.5 version`.
- Reffy change: `require-paseo-provisioning-credential`.

Rollout step 1 (Reffy) is done. Steps 2 (operator sets the secret) and 3
(paseo-core deploys) can proceed.

## What v1.9.5 does
- `reffy remote init --provision` sends `Authorization: Bearer
  ${PASEO_PROVISIONING_TOKEN}` on `POST /pods/{pod}/actors`, and on no other
  request.
- `POST /pods` is still sent with no `Authorization` header.
- The credential is read from the environment: the shell, the auto-loaded
  `.env`, or `--env-file`. Exported shell variables take precedence. The value
  is trimmed. It is never logged and never written to
  `.reffy/state/remote.json` or anywhere else.
- It is required **only** when a manager actor will be created. That means
  `--provision` with no manager actor id from `--manager-actor`,
  `PASEO_MANAGER_ACTOR`, or the saved linkage. Joining an existing manager
  never requires the credential and never sends it.
- A missing credential fails **before any network request**. That includes
  `POST /pods`, so a missing credential never leaves an orphaned pod behind.
- `PASEO_TOKEN` and `PASEO_PROVISIONING_TOKEN` never substitute for each
  other.
- The minted `managerAuthToken` is still printed once and not persisted, as
  before.

## Error mapping on actor creation
Matched as `POST` to a path ending in `/pods/{pod}/actors`, so endpoints with
a path prefix are also covered. These hints are checked before the generic
`PASEO_TOKEN` 401 hint.

| Paseo response | Reffy hint |
| --- | --- |
| `401` | "Paseo rejected the provisioning credential. Check that PASEO_PROVISIONING_TOKEN matches the deployment's provisioning secret." |
| `503`, `error.code === "provisioning_not_configured"` | "This Paseo deployment has no provisioning credential configured. The operator must set PASEO_PROVISIONING_TOKEN as a Worker secret before managers can be created." |
| `503`, body not JSON | Raw HTTP error. No parse failure. |

Missing credential message:

> `reffy remote init --provision` creates a Paseo manager actor, which
> requires PASEO_PROVISIONING_TOKEN (the deployment's provisioning
> credential, held by the Paseo operator). Add it to your .env or export
> it, then retry. The CLI never persists it.

## Test coverage
All 7 requested tests are covered, plus a few extra cases. The unit tests use
a mocked `fetch`; the CLI integration tests run against a local fake Paseo
server.
1. `createManagerActor` sends the provisioning bearer.
2. `createPod` sends no `Authorization` header.
3. `init --provision` without the credential fails before any request, even
   when `PASEO_TOKEN` is set.
4. `init --manager-pod --manager-actor` succeeds without the credential. Every
   request carries only `PASEO_TOKEN`.
5. A `401` on creation gives the provisioning hint, not the `PASEO_TOKEN`
   hint.
6. A `503 provisioning_not_configured` gives the operator hint. A non-JSON
   `503` is tolerated.
7. `remote.json` never contains the credential after a successful provision.
8. Extra: in a full `init --provision` run, the credential appears on exactly
   one request, and all manager calls use the minted manager token.

## Verification after the paseo-core deploy
Reffy will run step 4 of the rollout once paseo-core deploys. Against a
scratch workspace id, `reffy remote init --provision` should:
- succeed when `PASEO_PROVISIONING_TOKEN` is set;
- fail with the missing-credential message when it is not.

Please post here (or in a paseo-core artifact in `nuveris-v1`) when the
deploy lands.
