# Reffy CLI Handoff: Send the Provisioning Credential on `--provision`

For Reffy CLI developers (`~/dev/reffy`, currently v1.9.4). It describes a
small, self-contained change that paseo-core needs **released before**
paseo-core deploys its next security change.

Read it from any `nuveris-v1` project with:

```bash
reffy remote cat .reffy/artifacts/reffy_cli_provisioning_credential_handoff.md \
  --workspace-id nuveris-v1 --project-id paseo-core
```

Source change in paseo-core: `require-provisioning-credential`, task 3.3
(implemented on the paseo-core side; not yet deployed).

## What is changing in paseo-core
Creating an actor (`POST /pods/{pod}/actors`) will require a deployment
**provisioning credential**: the Worker secret `PASEO_PROVISIONING_TOKEN`,
held by the deployment operator.

- A missing or wrong bearer returns `401 Unauthorized` (plain text, no
  detail).
- If the deployment has no provisioning credential configured, creation
  returns `503` with a JSON body:
  `{ "ok": false, "error": { "code": "provisioning_not_configured", ... } }`.
- `POST /pods` (pod name minting) stays open, so it is unaffected.
- Every other route the Reffy CLI calls keeps using the manager token
  (`PASEO_TOKEN`). That covers manager workspaces, projects, workspace
  backends, push, ls and cat, so they are all unaffected.

**Only `reffy remote init --provision` breaks,** because it is the one Reffy
code path that creates an actor. Existing workspaces and every other remote
command keep working.

## The change

### 1. Send the credential when creating the manager
`PaseoManagerClient.createManagerActor` (`src/remote.ts`, around line 398)
posts to `${endpoint}/pods/${podName}/actors` with no `Authorization`
header. The shared `http()` helper already accepts a `token` option that
becomes `Authorization: Bearer <token>`, so the fix is to pass the
provisioning credential there.

Suggested shape (adapt to local style):

```ts
async createManagerActor(podName: string, provisioningToken: string): Promise<CreateManagerActorResult> {
  const result = await httpJson<{ actorId: string; managerAuthToken: string }>(
    `${this.endpoint}/pods/${podName}/actors`,
    {
      method: "POST",
      token: provisioningToken,
      body: JSON.stringify({ config: { /* unchanged */ } }),
    },
  );
  // unchanged validation
}
```

`createPod()` needs no change.

### 2. Resolve `PASEO_PROVISIONING_TOKEN` like `PASEO_TOKEN`
Add a resolver next to `resolvePaseoToken` in `src/cli.ts` (around line
1013) with the same rules:
- read it from the environment, including the auto-loaded `.env` and
  `--env-file`, with exported shell variables taking precedence;
- trim it;
- **never persist it** to `.reffy/state/remote.json` or anywhere else.

Require it **only** when `--provision` will create a manager actor, which is
the branch in `src/remote.ts` around line 646 (`if (!actorId)` with
`options.provision`). When an operator passes `--manager-pod` and
`--manager-actor`, nothing is created and the credential must not be
required.

Fail fast before any network call when it's missing, with a message such
as:

> `reffy remote init --provision` creates a Paseo manager actor, which
> requires `PASEO_PROVISIONING_TOKEN` (the deployment's provisioning
> credential, held by the Paseo operator). Add it to your `.env` or export
> it, then retry. The CLI never persists it.

Also update the stale comment near line 634 ("createPod and
createManagerActor do not require a bearer token"). After this change,
`createManagerActor` does.

### 3. Map the new failures to clear errors
`decorateRemoteError` (`src/cli.ts`, around line 1033) inspects
`RemoteHttpError`. Add a case for the creation path, matching a pathname of
`/pods/{pod}/actors` with nothing after it, **before** the generic `401`
hint. The generic hint blames `PASEO_TOKEN`, which would point the operator
at the wrong credential.

- `401` on creation: "Paseo rejected the provisioning credential. Check that
  `PASEO_PROVISIONING_TOKEN` matches the deployment's provisioning secret."
- `503` with `error.code === "provisioning_not_configured"` (parse
  `httpError.body` as JSON, tolerating non-JSON): "This Paseo deployment has
  no provisioning credential configured. The operator must set
  `PASEO_PROVISIONING_TOKEN` as a Worker secret before managers can be
  created."

### 4. Document it
- The `remote` skill body (`src/skills.ts`, around line 488, "Required
  environment"): add `PASEO_PROVISIONING_TOKEN`, noting it is needed only for
  `reffy remote init --provision`, is held by the Paseo operator, and is never
  persisted.
- The README or CHANGELOG remote-setup section, wherever `PASEO_TOKEN` is
  introduced.

## Security requirements
- Send the provisioning credential **only** on `POST /pods/{pod}/actors`.
  Never send it on any other request, never log it, and never write it to
  disk.
- Never fall back from `PASEO_TOKEN` to `PASEO_PROVISIONING_TOKEN`, or the
  reverse. They are different credentials with different holders. Paseo
  rejects a manager token for creation, and a provisioning token on manager
  routes.
- The manager token returned by creation (`managerAuthToken`) is still
  printed once for the operator to save. That behavior doesn't change.

## Tests to add
There is no provisioning coverage in `test/remote.test.ts` or
`test/cli.integration.test.ts` today. Add tests with a mocked `fetch`:

1. `createManagerActor` sends `Authorization: Bearer <provisioning token>`.
2. `createPod` sends no `Authorization` header.
3. `init --provision` without `PASEO_PROVISIONING_TOKEN` fails before any
   request, with the message above.
4. `init` with `--manager-pod` and `--manager-actor` (no `--provision`)
   succeeds without `PASEO_PROVISIONING_TOKEN`.
5. A `401` from creation produces the provisioning-specific hint, not the
   `PASEO_TOKEN` one.
6. A `503 provisioning_not_configured` produces the operator hint.
7. The provisioning credential never appears in
   `.reffy/state/remote.json` after a successful provision.

## Rollout order
1. **Reffy:** implement, test, and release (suggested v1.9.5). Sending a
   bearer that today's Paseo ignores is harmless, so this release is safe
   to ship before paseo-core changes.
2. **Paseo operator:** set `PASEO_PROVISIONING_TOKEN` as a Worker secret and
   in the operator's secret store and `.env`.
3. **paseo-core:** deploy `require-provisioning-credential`.
4. **Verify:** `reffy remote init --provision` against a scratch workspace
   id succeeds with the credential, and fails with the provisioning hint
   without it.

Please report the released version back to the paseo-core change (task
3.3), so the deploy can proceed.

## Out of scope
- Creating workspaces, registering projects, push, ls, cat and snapshot:
  they keep using `PASEO_TOKEN` and need no change.
- Any provisioning beyond the manager actor. The Reffy CLI creates nothing
  else directly; workspace backends are provisioned by the manager.
