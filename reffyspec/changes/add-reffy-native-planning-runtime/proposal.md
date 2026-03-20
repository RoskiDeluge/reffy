# Change: Add Native Reffy Planning Runtime

## Why
Reffy can now generate OpenSpec-compatible planning scaffolds from ideation artifacts, but it still depends on the external `openspec` runtime for validation and day-to-day inspection. That leaves Reffy as a scaffold generator rather than a planning runtime.

The next step is to replace the smallest useful slice of the OpenSpec runtime inside Reffy: validating generated planning structures and inspecting active planning work. This reduces external dependency without forcing archive behavior or a directory rename too early.

## What Changes
- Add native validation for generated planning changes through `reffy plan validate`.
- Add native inspection commands for generated planning changes through `reffy plan list` and `reffy plan show`.
- Keep the existing `openspec/` directory layout and file format as the compatibility target during this phase.
- Use the external `openspec` CLI as a parity oracle during development and verification, not as the primary runtime behavior being designed.
- Explicitly defer archive/lifecycle parity and any `reffyspec/` directory rename.

## Impact
- Affected specs: `planning-validation`, `planning-inspection`
- Affected code: `src/cli.ts`, new planning validation/inspection modules, parsing helpers for change/spec files, `README.md`, tests for parity against current OpenSpec-compatible change layouts.

## Reffy References
- `reffyspec-runtime-replacement-plan.md` - defines the runtime-replacement phases and recommends validation/list/show parity as the next scoped change.
- `reffyspec-refactor-plan.md` - provides the broader architectural direction for ReffySpec as an integrated planning subsystem.
- `decision-note-v1.md` - anchors the `.reffy/` canonical workspace and subsystem direction that this runtime work builds on.
