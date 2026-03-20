## Context
Reffy can now inspect active planning changes natively through `reffy plan list` and `reffy plan show`, but contributors still need the external `openspec` runtime to inspect the canonical spec state under `openspec/specs/`.

That creates an unnecessary split:
- active change inspection is native to Reffy
- current spec inspection is still external

This phase closes that gap by adding native spec read/list/show behavior while keeping the current OpenSpec-compatible layout.

## Goals / Non-Goals
- Goals:
  - Add `reffy spec list` for enumerating current specs.
  - Add `reffy spec show <spec-id>` for displaying current spec content.
  - Keep behavior compatible with the existing `openspec/specs/` layout.
  - Provide machine-readable and text-friendly outputs for local workflows and tests.
- Non-Goals:
  - Add spec mutation or archive behavior.
  - Rename `openspec/` directories.
  - Rebuild every upstream OpenSpec spec-view behavior in the first pass.

## Decisions
- Decision: Treat `openspec/specs/` as the compatibility source of truth during this phase.
  - Rationale: This preserves continuity while Reffy replaces the runtime behavior incrementally.
- Decision: Focus on listing and display only.
  - Rationale: Spec read parity is the missing runtime slice; write/archive behavior belongs later.
- Decision: Optimize for day-to-day inspection needs first.
  - Rationale: Users need to see spec IDs, purposes, and requirement content before they need deeper interactive features.

## Risks / Trade-offs
- Native display may initially expose less metadata than upstream OpenSpec.
  - Mitigation: Prioritize readable content and useful summaries, then expand only if needed.
- Spec parsing assumptions may not cover every historical spec shape immediately.
  - Mitigation: Target current project patterns and add representative tests.

## Migration Plan
1. Add parsing helpers for `openspec/specs/<capability>/spec.md`.
2. Implement `reffy spec list` with text and JSON output.
3. Implement `reffy spec show <spec-id>` with text and JSON output.
4. Add parity-oriented tests against representative existing specs.

## Open Questions
- Should `reffy spec show` include only `spec.md` content in the first pass, or also surface `design.md` when present?
- Should `reffy spec list` summarize requirement counts only, or also include purpose text when available?
