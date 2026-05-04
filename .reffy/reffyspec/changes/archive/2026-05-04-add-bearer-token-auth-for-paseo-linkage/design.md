# Design: Add bearer token auth and slim Paseo linkage state

## Context
After landing the manager + workspace-backend split, the CLI persists a v3 `remote.json` file that contains the Paseo endpoint plus identifiers for the manager actor and each provisioned workspace backend actor. Today those identifiers are also the only thing standing between an outsider and the underlying actors: anyone who knows them can hit the routes directly. The Paseo dev endpoint is currently not auth-protected, which makes the situation worse.

The goal of this change is twofold:

- Introduce a real authority layer (bearer tokens) so identifiers stop being secrets.
- Stop persisting the endpoint URL in `remote.json` so the file is safe to leak.

The CLI is the first client of this contract. Once the auth layer is in place the persisted shape can stay close to v3, minus the `endpoint` field.

### Problem Summary
- Identifiers in `remote.json` currently grant access. Sharing the manager across repos forces the operator to share names and treat them as secrets.
- The Paseo dev endpoint sits in a file that may end up in screenshots, logs, or accidental commits.
- The current "env override" pattern (`PASEO_ENDPOINT`, `PASEO_MANAGER_POD`, `PASEO_MANAGER_ACTOR`) hides nothing once init has run, because init writes the values back to `remote.json`.

## Goals / Non-Goals
Goals:
- Require a bearer token on every Paseo request issued by the CLI.
- Source endpoint and token from environment configuration only.
- Keep `remote.json` free of any access-granting information and free of the endpoint URL.
- Keep `remote.json` safe to leak: identifiers it carries should be inert without the token.
- Provide a clean transition: existing v3 `remote.json` files produce a reinitialize error rather than a silent migration.
- Provide a clear "save this token" handoff during fresh provisioning.

Non-Goals:
- Per-workspace tokens. One token per manager is enough for the realistic team-scoping case. Per-workspace can be added later as an additive change if hard isolation between workspaces under the same manager becomes a need.
- Per-user OAuth, SSO integration, or any external auth provider.
- Token storage in OS keychain, encrypted disk caches, or password managers built into the CLI.
- Persisting the token in any file Reffy writes.
- Bidirectional sync, conflict resolution, or any change to the existing manager / workspace backend route surface.

## Decisions
- Decision: One bearer token per manager actor. Manager validates on its own routes; workspace backend actors validate the same token, inherited from their parent manager at provisioning time.
  - Rationale: Matches how teams actually scope a "remote universe" (one Nuveris team = one manager = one shared token). Per-workspace tokens add management overhead with no current driver. Easy to add later if needed.
- Decision: Token is sourced from `PASEO_TOKEN` environment variable only. The CLI does not persist it.
  - Rationale: Eliminates the question of "where do we keep the token safely on disk" by not keeping it on disk at all. Operators put it in their secret store and export into shells / CI.
- Decision: Endpoint moves out of `remote.json`. `PASEO_ENDPOINT` env is the only source.
  - Rationale: The dev endpoint is currently unauthenticated. Any persisted root URL is one screenshot away from being public. This is a small but explicit hygiene win independent of the auth model.
- Decision: Bump linkage version to v4. Treat v3 as a reinitialize signal.
  - Rationale: Same migration pattern used for v1 -> v2 and v2 -> v3. The shape change is small (drop `endpoint`) but the auth invariants change meaningfully, so a clean cutover is safer than mixing versions.
- Decision: During `--provision`, the manager mints and returns a token. The CLI prints it once with bold "save this now, it will not be shown again" guidance.
  - Rationale: Aligns with how every well-behaved bearer-token system handles initial issuance. No persisted copy means no accidental leak through Reffy's files.
- Decision: For repos joining an existing manager, `reffy remote init` requires `PASEO_TOKEN` to already be set in env. No backend route retrieves an existing token.
  - Rationale: The token cannot be re-derived from the manager identity. The team secret store is the source of truth; the CLI never tries to fetch it.
- Decision: Map any `401` from any Paseo route to a single CLI hint that names `PASEO_TOKEN` as the likely cause.
  - Rationale: One shared failure mode deserves one shared message. Keeps the auth surface predictable.
- Decision: A `reffy remote token rotate` subcommand is in scope as a spec requirement, but its CLI implementation is conditional on the backend exposing a rotation route. The CLI ships first against today's contract; rotation lands when the backend is ready.
  - Rationale: Token rotation is the natural completion of a bearer-token system. Spec says what should exist; tasks call out the dependency.

## Data Model

### Local linkage (v4)
```json
{
  "version": 4,
  "provider": "paseo",
  "manager": {
    "pod_name": "...",
    "actor_id": "..."
  },
  "targets": {
    "nuveris-v1": {
      "workspace_backend": {
        "pod_name": "...",
        "actor_id": "..."
      },
      "last_imported_at": "2026-05-04T12:00:00.000Z"
    }
  }
}
```

Removed compared to v3:
- `endpoint` is no longer part of the file.

Unchanged compared to v3:
- `provider`, `manager.{pod_name, actor_id}`, `targets[ws].workspace_backend.{pod_name, actor_id}`, and `targets[ws].last_imported_at` all keep their v3 semantics. They are inert without a valid token.

### Required environment configuration
- `PASEO_ENDPOINT` - Paseo base URL.
- `PASEO_TOKEN` - bearer token for the linked manager.

A `.env` file in the repo root is the typical place; the CLI's existing `.env` loader covers it.

### Auth contract (CLI side)
- Every outbound HTTP request to Paseo includes:
  ```
  Authorization: Bearer ${PASEO_TOKEN}
  ```
- Pre-flight: the CLI fails before issuing any network call when either env var is missing, naming the missing variable.
- `401 Unauthorized` from any Paseo route is decorated with: "Authorization rejected by Paseo. Check that PASEO_TOKEN is set to the current manager token."

### First-time provisioning handoff
Output of `reffy remote init --provision` includes a clearly delimited section similar to:

```
Manager token (save this now; it will not be shown again):

  paseo_<...token...>

Add it to your team secret store and export PASEO_TOKEN before running any further reffy remote commands.
```

JSON output mode includes the token in a `manager_token` field for the same one-time handoff. The CLI does not log the token to its own state.

### Sharing across repos
- Person A: provisions once, captures the token from the init handoff.
- Team secret store (e.g. 1Password): holds `PASEO_ENDPOINT` and `PASEO_TOKEN`.
- Person B: drops both into the repo's `.env`, runs `reffy remote init --workspace-id <id>`, which resolves the workspace through the manager and registers the local project.

## Reffy Inputs
- reffy-cli-v2-paseo-reffy-backend.md

## Open Questions
- Hard cutover or shadow-log rollout on Paseo? Hard cutover is fine for this team but worth confirming so the backend agent and CLI ship in sync.
- Should the CLI eventually accept `--token <value>` for one-off testing, or is env-only the lasting answer? The current proposal is env-only; a flag is easy to add later if the dev loop needs it.
- For automated CI environments where exporting `PASEO_TOKEN` is awkward, should Reffy accept a token file path via `PASEO_TOKEN_FILE`? Defer until there is a concrete CI need.
