## Context
`reffy plan create` parses artifact Markdown into normalized heading buckets before deriving proposal, task, and spec content. The current implementation uses a plain object literal for those buckets. That is unsafe because normalized heading values can equal inherited `Object.prototype` member names.

### Problem Summary
- A heading such as `## Constructor` normalizes to `constructor`.
- The section map currently inherits from `Object.prototype`.
- `sections[current] ??= []` does not initialize a new array when `current` is `constructor`, because `sections.constructor` already resolves to an inherited function.
- The next `.push(...)` call throws and aborts planning generation for the workspace.

## Goals / Non-Goals
- Goals:
  - Make section parsing safe for normalized headings that match inherited object keys.
  - Preserve the current return shape consumed by `loadArtifactPlanningInputs`.
  - Add regression coverage for the observed failure mode.
- Non-Goals:
  - Redesign planning signal extraction heuristics.
  - Expand the set of recognized planning headings.
  - Change generated proposal, tasks, or spec templates beyond what is needed for the bug fix.

## Decisions
- Decision: Keep the section collection API object-shaped and make it prototype-safe.
  - Rationale: Callers already expect keyed lookups such as `sections["problem"]`. Using `Object.create(null)` fixes the bug locally without widening the change surface.
- Decision: Cover the regression through `reffy plan create` behavior rather than a parser-only test.
  - Rationale: The user-facing failure occurs in end-to-end planning generation, so the test should prove that the CLI workflow survives the problematic heading and still produces scaffolds.

## Reffy Inputs
- reffy_plan_create_constructor_heading_bug.md

## Open Questions
- None.
