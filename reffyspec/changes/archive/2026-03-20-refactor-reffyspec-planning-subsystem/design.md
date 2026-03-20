## Context
The current Reffy project already models artifact indexing and manifest validation, and its project conventions describe `.reffy/` as the intended workspace. This repository still uses `.references/` in practice, while the vendored ReffySpec/OpenSpec code at `.vendor/ReffySpec` represents a more mature but broader planning system than v1 requires.

The decision artifacts narrow the direction:
- `.reffy/` is the canonical workspace and manifest location.
- ReffySpec remains a planning subsystem inside Reffy.
- v1 generation is limited to proposals, tasks, spec deltas, and required boilerplate.

This change should therefore define the architectural boundary and migration strategy without forcing a full codebase merger.

## Goals / Non-Goals
- Goals:
  - Make `.reffy/` the single canonical workspace contract.
  - Define a planning subsystem that consumes indexed artifacts and emits OpenSpec-style planning outputs.
  - Preserve artifact metadata as the durable upstream source of planning context.
  - Keep v1 implementation lean and Node.js/TypeScript-native.
  - Provide a migration path from `.references/` to `.reffy/`.
  - Be explicit that `.vendor/ReffySpec` is a local reference codebase, not the canonical place where v1 planning behavior lives.
- Non-Goals:
  - Importing the full OpenSpec feature surface into Reffy.
  - Supporting harness-specific slash command workflows as primary UX.
  - Designing telemetry or remote coordination infrastructure.
  - Solving every long-term spec lifecycle concern in v1.

## Decisions
- Decision: Canonical workspace is `.reffy/`.
  - Rationale: Matches Reffy init behavior and avoids maintaining two equally valid workspace contracts.
- Decision: ReffySpec is a planning subsystem inside Reffy.
  - Rationale: Keeps the product model simple and avoids a heavy merger or branding split in v1.
- Decision: `.vendor/ReffySpec` is reference-only for v1.
  - Rationale: The vendored fork is useful for borrowing ideas, file shapes, and planning conventions, but the actual subsystem should be implemented as first-party Reffy behavior in this repo.
- Decision: Generated planning outputs are proposal, tasks, and spec delta scaffolds plus required boilerplate.
  - Rationale: This is the smallest useful planning surface that preserves OpenSpec compatibility where it matters.
- Decision: Legacy `.references/` layouts require an explicit migration/compatibility path.
  - Rationale: The current repo state proves this mismatch exists already; the transition must be intentional.
- Decision: CLI surface should center on stable verbs such as `reffy plan *` or equivalent command families.
  - Rationale: Core behavior should not depend on a specific agent harness.

## Risks / Trade-offs
- Migrating from `.references/` to `.reffy/` may create temporary documentation and tooling drift.
  - Mitigation: Define exact compatibility behavior and update managed instructions in the same change.
- Generating OpenSpec-style outputs without pulling in the full upstream implementation may miss edge-case behavior.
  - Mitigation: Limit v1 generation to deterministic scaffolding and document non-goals clearly.
- Keeping a vendored reference tree may confuse contributors about the true implementation boundary.
  - Mitigation: Document `.vendor/ReffySpec` explicitly as reference-only in proposal, design, and repo docs.
- Extending manifest-linked planning metadata too early may overcomplicate the contract.
  - Mitigation: Start with traceability fields only when they are required for generated outputs.

## Migration Plan
1. Define canonical `.reffy/` workspace behavior and legacy `.references/` compatibility expectations.
2. Document `.vendor/ReffySpec` as a reference input and define what, if anything, may be ported from it.
3. Update initialization/bootstrap/instruction flows to emit the canonical layout.
4. Add planning generation scaffolding with explicit artifact references.
5. Update docs and validation guidance to describe the new ideation-to-planning flow and the vendored fork's limited role.

## Open Questions
- Should `.references/` be auto-migrated, read as a compatibility alias, or only supported through a manual migration command?
- Should generated planning outputs live under `openspec/changes/` directly in v1, or under `.reffy/` first and then be promoted into `openspec/`?
