# Change: Add Native Reffy Spec Inspection

## Why
Reffy now supports native planning change validation and inspection for active work under `openspec/changes/`, but it still depends on the external `openspec` runtime to inspect the current spec state under `openspec/specs/`. That leaves runtime replacement incomplete for day-to-day read operations.

The next useful step is to add native spec inspection parity inside Reffy so contributors can enumerate and inspect current capabilities without leaving the Reffy runtime.

## What Changes
- Add native spec listing through `reffy spec list`.
- Add native spec display through `reffy spec show <spec-id>`.
- Keep the existing `openspec/specs/` directory layout and file format as the compatibility target during this phase.
- Reuse the same compatibility-first approach used in the planning runtime changes: Reffy owns the runtime behavior while `openspec/` remains the on-disk format target.
- Explicitly defer archive behavior and any directory rename.

## Impact
- Affected specs: `spec-inspection`
- Affected code: `src/cli.ts`, new spec inspection/parsing helpers, `README.md`, tests for spec list/show parity on the current `openspec/specs/` layout.

## Reffy References
- `reffyspec-runtime-replacement-plan.md` - defines phase 3 as read/list/show parity and positions spec inspection as a native runtime concern.
- `reffyspec-refactor-plan.md` - provides the broader runtime replacement and planning subsystem context.
- `decision-note-v1.md` - anchors the v1 subsystem direction this native runtime work continues.
