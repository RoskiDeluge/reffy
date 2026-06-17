## Context
This session implemented the pivot-supersession convention (the `## Supersedes` proposal section and the "Representing Pivots" `AGENTS.md` guidance) directly, since the artifact `pivots-as-superseding-changes.md` concluded the convention itself does not warrant a formal spec. Adding `supersede-change` to the built-in managed skill set, however, touches canonical truth: the `skills-directory` spec explicitly enumerates the managed skills. This change codifies that one delta through the proper mechanism instead of a direct edit.

## Goals / Non-Goals
- Goals:
  - Record the seventh managed skill (`supersede-change`) in canonical `skills-directory` truth.
  - Capture that the skill is the active recognition/trigger layer for pivot intent, distinct from the passive representation convention.
- Non-Goals:
  - Re-spec the `## Supersedes` proposal convention (deliberately left as a convention per the artifact).
  - Add `reffy plan validate`/`show` logic to resolve supersedes links (a later, only-if-load-bearing item).

## Decisions
- Decision: Model the skill addition as a `MODIFIED` enumeration plus an `ADDED` requirement on `skills-directory`, not a new capability.
  - Rationale: It extends an existing capability; a separate capability would fragment the skills contract.
- Decision: This change is additive, not itself a pivot — `## Supersedes` is `None`.
  - Rationale: It expands the managed set rather than reversing prior direction.
- Decision: Tasks are recorded as already-complete because the code shipped during implementation; the change documents the canonical-truth delta retroactively.
  - Rationale: Staying true to the philosophy that canonical-truth changes ride the change mechanism, even when implementation preceded codification.

## Reffy Inputs
- pivots-as-superseding-changes.md

## Open Questions
- None.
