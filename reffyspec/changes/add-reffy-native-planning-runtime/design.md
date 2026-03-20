## Context
Reffy already owns the artifact layer and can generate OpenSpec-compatible planning scaffolds. The remaining dependency on the external `openspec` runtime is concentrated in runtime behaviors rather than file generation:

- validate a change directory
- list active changes
- show change content

This makes validation and inspection the right next replacement slice. They are useful enough to reduce dependency meaningfully, but still less risky than archive behavior.

## Goals / Non-Goals
- Goals:
  - Add native `reffy plan validate` support for generated planning changes.
  - Add native `reffy plan list` and `reffy plan show` support for active planning work.
  - Keep behavior compatible with the current `openspec/` directory structure and spec/change format.
  - Make parity measurable against the external `openspec` CLI for representative local cases.
- Non-Goals:
  - Implement archive behavior in this change.
  - Rename `openspec/` to `reffyspec/`.
  - Reproduce every upstream OpenSpec edge case in the first pass.
  - Replace the upstream runtime everywhere before parity is demonstrated locally.

## Decisions
- Decision: Treat `openspec/` as the compatibility format during this phase.
  - Rationale: This keeps migration smaller and lets native Reffy behavior be compared directly against a stable external oracle.
- Decision: Implement validation and inspection together in one change.
  - Rationale: They use overlapping parsing logic for changes, tasks, and spec delta files.
- Decision: Match the active project workflow before chasing full upstream coverage.
  - Rationale: The objective is to replace the runtime that Reffy actually needs, not to clone every OpenSpec feature.
- Decision: Keep archive parity out of scope.
  - Rationale: Archive behavior is more destructive and should follow only after validation and inspection behavior are stable.

## Risks / Trade-offs
- Native validation may disagree with `openspec validate` on edge cases.
  - Mitigation: Scope the first pass to active project patterns and add parity tests against representative generated changes.
- Native list/show may present less information than upstream OpenSpec initially.
  - Mitigation: Target the information contributors need day-to-day first: change IDs, file presence, task counts, and readable content views.
- Combining validation and inspection in one phase increases scope.
  - Mitigation: Share parsing infrastructure but keep command behavior narrowly defined.

## Migration Plan
1. Add parsing helpers for active change directories and delta specs.
2. Implement `reffy plan validate` for structural checks and requirement/scenario formatting rules.
3. Implement `reffy plan list` for active change enumeration with basic status summaries.
4. Implement `reffy plan show` for readable change inspection.
5. Add parity-focused tests using generated planning changes and current `openspec/`-compatible layouts.

## Open Questions
- Should `reffy plan show` default to proposal content only, or include proposal/tasks/design/spec summaries in one response?
- Should `reffy plan list` expose a JSON shape that is intentionally close to `openspec list --json`, or only optimize for Reffy’s own CLI needs?
