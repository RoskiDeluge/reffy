# Change: Send a Paseo application descriptor on manager creation

## Why
Every manager actor paseo-core creates is an **application**, which the deployment registers with its control plane (LogicalAssembly) as soon as it exists. The registration carries a descriptor (`id`, `name`, `description`, `owner`). `reffy remote init --provision` creates its manager without one, so paseo-core mints an `id` and leaves the other fields `null`, and the application reaches LogicalAssembly with nothing to show staff (as happened to `servco-fde`, application `d35eab6d…`, on 2026-10-20). paseo-core already accepts descriptors; nothing on their side blocks this change.

## What Changes
- When `reffy remote init --provision` creates a manager actor, send an `application` block **inside `config`** on `POST /pods/{pod}/actors` with `name` (the selected workspace id), `description` (the `--label`, else `Reffy workspace backend for <workspace-id>`), and `owner`. Never send `id`.
- Resolve `owner` from `--owner`, then `PASEO_APPLICATION_OWNER` (shell, `.env`, or `--env-file`), then the repo's `git config user.email`; omit it when none yields a value.
- Accept `--name` and `--description` as explicit overrides for the descriptor; validate field lengths before any request.
- Report the descriptor sent and the stored application returned by Paseo in `remote init` output (text and JSON), and persist the returned `application.id` as `application_id` in `.reffy/state/remote.json`.
- Add `reffy remote application get` (`GET …/application`) and `reffy remote application set [--name] [--description] [--owner]` (`PUT …/application`, merge semantics) authenticated with `PASEO_TOKEN`, so applications created before this change (e.g. `servco-fde`) can be described.

## Impact
- Affected specs: `remote-workspace-manager`
- Affected code: `src/remote.ts`, `src/cli.ts`, `src/types.ts`, `src/skills.ts` (managed `sync-remote` skill), `README.md`, `test/remote.test.ts`, `test/cli.integration.test.ts`
- Compatibility: `remote.json` stays at version 4; `application_id` is optional and older files read unchanged. No change for joining an existing manager. Any extra field in the descriptor is rejected by paseo-core with `400`, so the CLI sends only `name`, `description`, `owner`.
- Reply: report the shipping CLI version and the verification run's application id back to paseo-core in a `reffy` artifact.

## Supersedes
None

## Reffy References
- `reffy-cli-application-descriptor-handoff.md` - paseo-core handoff describing the descriptor contract, field rules, owner resolution order, and the optional update route (mirrored from `nuveris-v1/paseo-core`)
