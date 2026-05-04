# Change: Add bearer token auth and slim Paseo linkage state

## Why
The CLI is the first client of the Paseo workspace manager and per-workspace backend actors. Today, anything that knows the manager pod and actor id (or any provisioned workspace backend pod and actor id) can reach the corresponding actor's routes directly. The local linkage file `remote.json` persists those identifiers along with the Paseo `endpoint`, so the file effectively carries access-granting information even though it is only meant to be local runtime state.

Two practical problems follow:

- Sharing the manager across repos requires sharing the manager pod and actor id. The current "share via env" workaround treats names as secrets, which is fragile: one accidental commit, one bug-report screenshot, and the names are out.
- The Paseo dev endpoint is currently not auth-protected. Persisting the root URL in `remote.json` makes it easier than necessary to leak that base URL to anyone who pulls the repo or sees a screenshot.

A bearer token model gives the system real authority separation: identifiers describe *what* an actor is, the token decides *who* may talk to it. That allows:

- Identifiers (manager pod and actor id, workspace backend pod and actor id) to live in `remote.json` as inert references that grant nothing on their own.
- Tokens to rotate without re-provisioning actors.
- A single shared secret to scope a "remote universe" (one manager and every workspace it provisioned) cleanly across repos.

This change pairs that with one explicit hygiene win: the Paseo `endpoint` moves out of `remote.json` and is required from environment configuration only. The combination keeps the linkage file safe to leak and concentrates the secrets that matter into a single sharable surface.

## What Changes
- Require every CLI request against Paseo to send `Authorization: Bearer ${PASEO_TOKEN}`.
- Require `PASEO_TOKEN` and `PASEO_ENDPOINT` to be configured through environment (typically `.env`) for any non-help remote command. The CLI fails fast with actionable guidance when either is missing.
- Bump local linkage state to v4 and remove `endpoint` from the persisted shape. Treat existing v3 `remote.json` files as a hard reinitialize signal, consistent with prior remote-config version transitions.
- During `reffy remote init --provision`, the CLI prints the provisioned manager token once with strong "save this now, it will not be shown again" guidance. The CLI does not persist the token to disk.
- During `reffy remote init` against an existing manager, the CLI requires the operator to supply the existing token via env. No backend call retrieves a token after provisioning.
- Map `401 Unauthorized` responses from any Paseo route to a single CLI message that names `PASEO_TOKEN` as the likely cause and points at where to set it.
- Keep the existing manager and workspace backend route surface unchanged. The auth contract is layered over what already exists.
- Optionally surface a `reffy remote token rotate` subcommand once the Paseo manager exposes a rotation route. The spec defines the requirement; CLI implementation is conditional on the backend route landing.
- Out of scope for this change: per-workspace tokens, per-user OAuth, token storage in OS keychain, or any auth model other than a single shared bearer token per manager.

## Impact
- Affected specs:
  - `remote-sync-snapshot-publication`
  - `remote-workspace-manager`
- Affected code:
  - `src/types.ts`
  - `src/remote.ts`
  - `src/cli.ts`
  - remote tests
  - `README.md`
- Affected user-facing behavior:
  - `reffy remote init`, `status`, `push`, `ls`, `cat`, `snapshot`, and the `workspace`/`project` subcommands all require `PASEO_ENDPOINT` and `PASEO_TOKEN` from env.
  - First-time provisioning prints the new token once. Saving it to a team secret store is the operator's responsibility.
  - Existing v3 `remote.json` files produce a clean reinitialize error that points at the new flow.
- Affected backend assumptions:
  - The Paseo manager actor accepts and validates a bearer token on every request.
  - Workspace backend actors validate the same token (inherited from the manager that provisioned them).
  - All routes return `401 Unauthorized` for missing or wrong tokens.

## Reffy References
- `reffy-cli-v2-paseo-reffy-backend.md` - planning input artifact describing the live two-actor contract this change layers auth over.
