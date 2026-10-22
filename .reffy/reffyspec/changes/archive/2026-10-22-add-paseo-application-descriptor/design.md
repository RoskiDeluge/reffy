## Context
paseo-core accepts an optional application descriptor on manager creation and exposes `GET`/`PUT /pods/{pod}/actors/{actor}/application` under the manager token. The descriptor must sit inside `config`; a sibling block is silently ignored.

## Goals / Non-Goals
- Goals:
  - Every manager created by `reffy remote init --provision` reaches LogicalAssembly with a name, description, and (when resolvable) owner.
  - Existing blank applications can be described from the CLI.
- Non-Goals:
  - Choosing or sending an application `id` (paseo-core mints it and it is immutable).
  - Enforcing ownership; `owner` is opaque text.

## Decisions
- Decision: `name` defaults to the selected workspace id; `description` defaults to `--label`, else `Reffy workspace backend for <workspace-id>`.
  - Rationale: matches the handoff's suggested values; a manager is provisioned while initializing one workspace.
- Decision: `owner` resolves `--owner` → `PASEO_APPLICATION_OWNER` → `git config user.email` (run in the repo root; failures yield no value). Owner is resolved only when a manager actor will be created; `application set` sends `owner` only when `--owner` is given.
  - Rationale: paseo-core has no user identity; the CLI decides and records verbatim.
- Decision: validate lengths client-side (`name` 1–200, `description` ≤2000, `owner` 1–256) and fail before any request.
  - Rationale: avoids leaving an orphaned pod when the descriptor would be rejected.
- Decision: persist the returned application id as a top-level optional `application_id` in `remote.json` (v4), kept only while the manager identity is unchanged.
  - Rationale: the id belongs to the manager; dropping it on a manager switch avoids pointing at the wrong application. No version bump since the field is optional.
- Decision: `application set` sends only the flags supplied (merge semantics) and requires at least one; clearing a field (`null`) is not exposed.
  - Rationale: covers backfilling blank applications; clearing can be added when needed.
- Decision: tolerate both `{ application: {...} }` and bare-descriptor response shapes from `GET`/`PUT …/application`.

## Reffy Inputs
- reffy-cli-application-descriptor-handoff.md

## Open Questions
- None.
