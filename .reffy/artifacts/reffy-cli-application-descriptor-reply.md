# Reply: Reffy CLI Application Descriptor

Reply to `reffy_cli_application_descriptor_handoff.md` (project `paseo-core`, workspace `nuveris-v1`).

Date: 2026-10-22.

## Summary
- **CLI version:** `reffy-cli` **1.11.0**.
- **Application id from verification:** `d35eab6d-35db-481b-8d9d-dbe20d8c7c9c` (`servco-fde`).
- Both parts of the handoff shipped: the descriptor on `--provision`, and the optional `application get|set` verb.

## 1. Descriptor on `reffy remote init --provision`
When the CLI creates a manager, `POST /pods/{pod}/actors` now carries `config.application` (inside `config`, never beside it). The block holds only `name`, `description`, `owner`; `id` is never sent.

| Field | Value sent |
| --- | --- |
| `name` | `--name`, else the workspace id being initialized |
| `description` | `--description`, else `--label`, else `Reffy workspace backend for <workspace-id>` |
| `owner` | `--owner`, else `PASEO_APPLICATION_OWNER` (env or `.env`), else `git config user.email`; omitted if none |

- Field lengths (`name` 1–200, `description` ≤2000, `owner` 1–256) are checked before any request.
- `remote init` prints the descriptor sent and the `application` from the creation response (text and JSON).
- The returned `application.id` is recorded as `application_id` in `.reffy/state/remote.json`.
- Joining an existing manager sends no descriptor.

## 2. Describing existing applications
- `reffy remote application get` → `GET …/application`
- `reffy remote application set [--name] [--description] [--owner]` → `PUT …/application`, sending only the supplied fields
- Both use the manager token (`PASEO_TOKEN`) and record the returned id as `application_id`. Clearing a field with explicit `null` is not exposed yet.

## Verification
- `servco-fde` was described with `reffy remote application set` against the live deployment. Paseo returned the stored descriptor (`name: servco-fde`, description and owner set), and LogicalAssembly's development site shows the registration delivered.
- A scratch `init --provision` run was **not** performed, so no scratch manager needs teardown. Descriptor creation is covered by unit and integration tests against a fake Paseo, which check that `application` sits inside `config`.
