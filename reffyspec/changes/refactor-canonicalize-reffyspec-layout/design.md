## Context
Reffy now owns scaffold generation, validation, inspection, and archive behavior natively. The project has already declared Reffy independent in runtime terms. What remains is the compatibility-era naming surface:

- `openspec/changes/`
- `openspec/specs/`
- `openspec/AGENTS.md`
- docs and templates that still talk about OpenSpec as part of the normal workflow

That surface made sense while Reffy was still replacing runtime behavior incrementally. After phase 5, it has become the main source of conceptual drift.

## Goals / Non-Goals
- Goals:
  - Make `reffyspec/` the canonical planning/spec directory.
  - Perform a one-time migration from `openspec/` to `reffyspec/`.
  - Update runtime code, managed instructions, docs, and tests to use ReffySpec naming.
  - Remove OpenSpec from normal guidance except where explicit migration/history context still matters.
- Non-Goals:
  - Maintain dual first-class support for both `openspec/` and `reffyspec/` indefinitely.
  - Continue exporting OpenSpec-native outputs as a core requirement.
  - Rebuild unrelated planning semantics that are already working.
  - Rename `.reffy/`; this change is about the planning/spec surface, not the artifact workspace.

## Decisions
- Decision: `reffyspec/` becomes the canonical on-disk layout.
  - Rationale: The runtime and product boundary are already Reffy-native, so the directory structure should stop implying otherwise.
- Decision: Use a one-time migration path instead of dual-layout long-term support.
  - Rationale: Supporting both layouts would prolong confusion and preserve compatibility complexity that the project no longer wants.
- Decision: Reffy no longer treats OpenSpec export compatibility as a required v1 deliverable.
  - Rationale: The project has chosen native ownership over continued compatibility-centric framing.
- Decision: Remove OpenSpec from normal AGENTS/docs guidance, except where explicit migration or historical explanation still provides value.
  - Rationale: Guidance should reflect the current product boundary rather than old transition assumptions.

## Proposed Migration Shape
1. Introduce `reffyspec/` path resolution in runtime code and make it canonical.
2. Provide an explicit migration command or automatic one-time migration for existing repos that still have `openspec/`.
3. Update scaffolds, runtime inspection, archive behavior, and tests to target `reffyspec/`.
4. Update AGENTS/docs/templates to refer to ReffySpec instead of OpenSpec in normal usage.
5. Remove or sharply reduce compatibility-era wording once migration is complete.

## Risks / Trade-offs
- A one-time migration is more disruptive than preserving compatibility.
  - Mitigation: make migration deterministic, auditable, and covered by tests.
- Existing repos or docs may still refer to `openspec/` paths.
  - Mitigation: update first-party docs and provide clear migration behavior.
- Removing OpenSpec from normal guidance may make historical context harder to follow.
  - Mitigation: keep narrowly scoped historical explanation where it materially helps migration.

## Migration Plan
1. Audit all path assumptions and explicit `openspec/` naming in runtime code, docs, and tests.
2. Implement canonical `reffyspec/` path handling plus one-time migration from `openspec/`.
3. Update generated scaffolds and runtime outputs to use `reffyspec/`.
4. Update AGENTS/docs so ReffySpec is the normal planning/spec language.
5. Verify migrated repositories still support the normal Reffy planning lifecycle end to end.

## Open Questions
- Should migration happen implicitly during `reffy init/bootstrap`, or through an explicit `reffy` migration command for the planning layout?
- Should any small compatibility alias remain temporarily for local developer convenience, or should the rename be strict immediately?
