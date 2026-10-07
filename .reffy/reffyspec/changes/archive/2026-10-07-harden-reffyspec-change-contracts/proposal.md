# Change: Harden ReffySpec change contracts

## Why
`reffy plan validate` currently checks for required planning files but silently accepts arbitrary additional paths. `reffy plan archive` then preserves those paths even though they have no documented semantic role. This makes incidental filesystem tolerance look like a supported extension API.

The validation and archive contracts also disagree: validation recognizes `ADDED`, `MODIFIED`, `REMOVED`, and `RENAMED` delta sections, while archive can apply only `ADDED` and `MODIFIED`. Separately, manifest `derived_outputs` links can continue to point at planning files that no longer exist. A reported-valid workspace or change therefore does not reliably guarantee that archive will succeed or that its traceability links are usable.

## What Changes
- **BREAKING**: Define the active ReffySpec change tree as exhaustive and reject every undocumented file or directory. The only allowed top-level entries are `proposal.md`, `tasks.md`, optional `design.md`, and `specs/`; each capability directory under `specs/` may contain only `spec.md`.
- Report all unexpected paths in one validation pass with guidance to move durable decisions into `design.md`, checklist work into `tasks.md`, and exploratory context into `.reffy/artifacts/`.
- Use one shared structural and delta contract for validation and archive preflight so an invalid change cannot move files, update canonical specs, or rewrite manifest links.
- Implement archive semantics and semantic preflight for all four documented delta operations: `ADDED`, `MODIFIED`, `REMOVED`, and `RENAMED`.
- Validate that repository-relative `derived_outputs` links resolve to existing files, and reconcile links for an archived change by rewriting moved outputs and pruning superseded outputs that no longer exist.
- Update CLI documentation and managed ReffySpec guidance to present the supported change tree as exhaustive and document the `RENAMED` `FROM`/`TO` format.

## Impact
- Affected specs: `planning-validation`, `planning-archive`, `artifact-planning`, `reffyspec-layout`
- Affected code: `src/plan-runtime.ts`, `src/plan-archive.ts`, shared planning parsers/contracts, manifest validation and traceability helpers, managed instructions/skills, CLI/README documentation, and integration/unit tests
- Compatibility: repositories using undocumented change-local files must consolidate them into the supported documents or move exploratory material into `.reffy/artifacts/` before validation or archive succeeds

## Supersedes
None

## Reffy References
- `reffy-cli-rules-hardening.md` - documents the permissive change-tree behavior, validation/archive mismatch, stale traceability links, and desired strict contract
