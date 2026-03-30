## Context
Reffy can now perform the read and validation portions of the planning workflow natively, but the lifecycle still stops short of completion because archive behavior remains external. In the current compatibility model, archive means more than moving files:

- completed change directories move under `openspec/changes/archive/`
- current spec state may need updates in `openspec/specs/`
- traceability should survive the transition from active to archived work

This phase is riskier than previous phases because it changes repository state. The implementation must therefore stay conservative, deterministic, and easy to verify.

## Goals / Non-Goals
- Goals:
  - Add `reffy plan archive <change-id>` for native archive behavior.
  - Preserve compatibility with the existing `openspec/changes/archive/` layout.
  - Update current spec state where archived changes affect compatible spec files.
  - Preserve artifact-to-output traceability during archiving.
- Non-Goals:
  - Rename the underlying `openspec/` directory structure.
  - Introduce a broad new metadata model for archived objects.
  - Reproduce every upstream OpenSpec archive edge case in the first pass.
  - Implement destructive bulk archive operations before single-change behavior is solid.

## Decisions
- Decision: Archive one change at a time through `reffy plan archive <change-id>`.
  - Rationale: Limits destructive scope and makes verification simpler.
- Decision: Keep the existing `openspec/changes/archive/YYYY-MM-DD-<change-id>/` style layout or equivalent date-prefixed archive destination.
  - Rationale: Preserves compatibility and keeps archive history understandable.
- Decision: Treat spec updates as part of archive behavior, not a separate manual follow-up.
  - Rationale: Archive parity is incomplete if current truth remains stale.
- Decision: Preserve traceability fields for affected artifacts when active outputs are archived.
  - Rationale: Reffy’s planning model depends on durable links between ideation artifacts and downstream planning artifacts.

## Risks / Trade-offs
- Archive behavior is inherently destructive if done incorrectly.
  - Mitigation: Require explicit change IDs, validate inputs first, and verify destination state after archiving.
- Updating current specs may diverge from upstream OpenSpec merge semantics.
  - Mitigation: Scope the first pass to the compatible spec patterns Reffy already generates and tests.
- Archived output paths may invalidate manifest traceability if links are not updated.
  - Mitigation: Update derived output references as part of the archive transaction.

## Migration Plan
1. Add archive helpers for locating active change files and archive destinations.
2. Implement a conservative archive flow for moving one active change into the archive tree.
3. Update current spec files based on the archived change's delta specs for the supported compatibility cases.
4. Update artifact traceability references so archived outputs remain discoverable.
5. Add automated tests for archive movement, spec updates, and traceability preservation.

## Open Questions
- Should `reffy plan archive` require an explicit confirmation flag for non-interactive safety, or is explicit change ID plus standard CLI execution sufficient?
- For the first pass, should unsupported delta merge cases fail fast instead of attempting partial archive behavior?
