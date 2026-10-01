# Rollout Step 4 Result: `reffy remote init --provision` Against Live paseo-core

For paseo-core developers. This answers
`paseo_provisioning_credential_deploy_notice.md` (project `paseo-core`).
**All three checks passed.** Rollout of `require-provisioning-credential` is
complete from Reffy's side.

Read it from any `nuveris-v1` project with:

```bash
reffy remote cat .reffy/artifacts/reffy-provisioning-credential-rollout-verification.md \
  --workspace-id nuveris-v1 --project-id reffy
```

## Setup
- CLI: `reffy-cli@1.9.5` from npm (`npx -y reffy-cli@1.9.5`), run on
  2026-10-01.
- Endpoint: `https://paseo-core.paseo.workers.dev`.
- Each check ran in its own throwaway local repo. `nuveris-v1` and its
  manager were not touched.
- The provisioning credential came from an operator-held `.env` through
  `--env-file`. It was not copied into the scratch repos.

## Results
| # | Check | Result |
| --- | --- | --- |
| 1 | `init --provision` with `PASEO_PROVISIONING_TOKEN` set | **Pass.** Exit `0`. Created a pod, a manager actor and the workspace `reffy-provision-scratch`, and registered the project. Printed the manager token once with `manager_token_persisted: false`. The credential does not appear anywhere in the scratch repo, including `.reffy/state/remote.json`. |
| 2 | `init --provision` without `PASEO_PROVISIONING_TOKEN` | **Pass.** Exit `1` with the missing-credential message ("...requires PASEO_PROVISIONING_TOKEN (the deployment's provisioning credential, held by the Paseo operator)..."). No `.reffy/state/` was written. The unit and integration tests confirm no request is sent. |
| 3 | `init --provision` with a wrong `PASEO_PROVISIONING_TOKEN` | **Pass.** Exit `1` with `401 Unauthorized` and the provisioning hint: "Paseo rejected the provisioning credential. Check that PASEO_PROVISIONING_TOKEN matches the deployment's provisioning secret." The `PASEO_TOKEN` hint did not appear. No `.reffy/state/` was written. |

Check 3 reused check 1's pod (`--manager-pod`), so it created no extra pod.

## Scratch resources to clean up
paseo-core has no pod or actor deletion API yet, so these stay in place.
Please have the operator remove them once deletion exists:

| Resource | Pod | Actor |
| --- | --- | --- |
| Scratch manager (`reffyWorkspaceManager.v1`) | `e2310019-ee04-4e08-91eb-e5c4e3f5526c` | `93a57ab2-48dd-43e0-9906-f67f7624b9a2` |
| Scratch workspace backend (`reffy-provision-scratch`) | `e2310019-ee04-4e08-91eb-e5c4e3f5526c` | `afee8905-afb7-4cdd-9385-534e75d8abea` |

The scratch manager token was printed once and then discarded. It was not
saved anywhere, so the scratch manager is effectively inert.

## Reffy follow-up
- Reffy change `require-paseo-provisioning-credential` is archived. Its
  requirements are now in Reffy's `remote-workspace-manager` spec.
- Known edge, not blocking: a fresh `--provision` with a *wrong* credential
  creates a pod via the open `POST /pods` before actor creation returns
  `401`, so the pod is left behind. Reffy can't detect a wrong credential
  ahead of time. If orphaned pods become a problem, paseo-core could gate
  `POST /pods` as well, or offer a credential check endpoint.
