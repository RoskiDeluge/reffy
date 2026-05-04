## 1. Implementation
- [x] 1.1 Add a v4 `remote.json` shape that drops `endpoint` and keeps `version`, `provider`, `manager`, and per-workspace `workspace_backend` plus `last_imported_at`. Update read/write helpers and types to round-trip the v4 shape.
- [x] 1.2 Refuse to load v3 `remote.json` silently and emit a reinitialize error pointing users at the new bearer-token-aware `reffy remote init` flow.
- [x] 1.3 Require `PASEO_ENDPOINT` and `PASEO_TOKEN` from environment for any non-help remote command. Fail fast before any network call when either is missing, naming the missing variable.
- [x] 1.4 Add an `Authorization: Bearer ${PASEO_TOKEN}` header on every Paseo HTTP request issued by the CLI (manager and workspace backend clients).
- [x] 1.5 Map `401 Unauthorized` responses from any Paseo route to a single decorated CLI message that names `PASEO_TOKEN` as the likely cause.
- [x] 1.6 During `reffy remote init --provision`, print the manager token returned by the backend once with strong "save this now" guidance in text mode, and include it as `manager_token` in JSON output. Do not persist the token to disk.
- [x] 1.7 During `reffy remote init` against an existing manager, require `PASEO_TOKEN` to already be set; do not attempt any backend call to retrieve a token.
- [x] 1.8 Update `reffy remote init` so it no longer reads, writes, or surfaces `endpoint` in the persisted `remote.json` (endpoint stays env-only). Status output may still print the endpoint that was used for the request.
- [ ] 1.9 Add a spec-level requirement and CLI scaffold for `reffy remote token rotate`. CLI implementation is conditional on the Paseo manager exposing a rotation route; ship the spec now, ship the CLI when the backend route lands.
- [x] 1.10 Update help text and README to describe the new env-required flow, the one-time token handoff, and the slimmer linkage shape.
- [x] 1.11 Bump the package version and note the breaking change to `remote.json`.

## 2. Verification
- [x] 2.1 Run `reffy plan validate add-bearer-token-auth-for-paseo-linkage`.
- [x] 2.2 Run `npm run check`.
- [x] 2.3 Run `npm test`.
- [x] 2.4 Verify a v3 `remote.json` produces a clear reinitialize error and is not silently migrated.
- [x] 2.5 Verify any non-help remote command fails before making network calls when `PASEO_ENDPOINT` or `PASEO_TOKEN` is missing, naming the missing variable.
- [x] 2.6 Verify the CLI sends `Authorization: Bearer ${PASEO_TOKEN}` on every Paseo request, and that a `401` response surfaces the documented hint.
- [x] 2.7 Verify `reffy remote init --provision` prints the manager token once in both text and JSON modes and never writes it to disk.
- [x] 2.8 Verify `reffy remote init` against an existing manager succeeds when `PASEO_TOKEN` is set and fails clearly when it is not.
- [x] 2.9 Verify `remote.json` after init contains no `endpoint` field and no token-bearing data.
- [ ] 2.10 Once the Paseo manager exposes a rotation route, smoke-test `reffy remote token rotate` end-to-end and confirm subsequent calls require the new token.
