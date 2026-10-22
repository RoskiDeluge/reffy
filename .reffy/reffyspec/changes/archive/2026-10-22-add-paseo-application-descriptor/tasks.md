## 1. Implementation
- [x] 1.1 `src/remote.ts`: add descriptor types and validation; send `config.application` from `createManagerActor`; parse the returned `application`.
- [x] 1.2 `src/remote.ts`: thread the descriptor through `ensureManagerInit`; persist `application_id`, keeping it only while the manager identity is unchanged; read it back in `readRemoteConfig`.
- [x] 1.3 `src/remote.ts`: add `PaseoManagerClient.getApplication` / `setApplication`.
- [x] 1.4 `src/cli.ts`: add `--owner`, `--name`, `--description` flags; resolve owner (`--owner` → `PASEO_APPLICATION_OWNER` → `git config user.email`) only when a manager actor will be created; print the descriptor and application id from `remote init`.
- [x] 1.5 `src/cli.ts`: add `reffy remote application get|set`.
- [x] 1.6 `src/skills.ts` + managed `sync-remote` skill, `README.md`: document the descriptor, `PASEO_APPLICATION_OWNER`, and the `application` verbs.

## 2. Tests
- [x] 2.1 `createManagerActor` nests `application` inside `config` and never sends `id`.
- [x] 2.2 `init --provision` sends name/description/owner from defaults, `--label`, `PASEO_APPLICATION_OWNER`, and `--owner`; omits owner when none resolves; persists `application_id`.
- [x] 2.3 Joining an existing manager sends no descriptor.
- [x] 2.4 Invalid descriptor values fail before any request.
- [x] 2.5 `application get` / `set` call the right routes with `PASEO_TOKEN`; `set` without fields fails before any request.

## 3. Verification and reply
- [x] 3.1 Run `pnpm build`, `pnpm check`, and `pnpm test`.
- [x] 3.2 Run `reffy plan validate add-paseo-application-descriptor`.
- [x] 3.3 Verify against the live deployment: `reffy remote application set` on `servco-fde` stored the descriptor and LogicalAssembly shows it delivered. A scratch `init --provision` run was deferred to avoid an undeletable scratch manager; descriptor creation is covered by tests.
- [x] 3.4 Describe `servco-fde` with `reffy remote application set`.
- [x] 3.5 Release and reply to paseo-core in a `reffy` artifact with the CLI version and verification application id.
