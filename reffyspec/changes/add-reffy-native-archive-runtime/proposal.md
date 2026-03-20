# Change: Add Native Reffy Archive Runtime

## Why
Reffy now supports native planning scaffold generation, planning validation, planning inspection, and spec inspection while still targeting the OpenSpec-compatible on-disk format. The remaining major runtime gap is lifecycle completion: archiving completed changes and updating current spec state.

Without native archive behavior, Reffy still depends on the external `openspec` runtime to complete the planning loop. That means runtime replacement remains incomplete even though the read/validate workflows are now native.

## What Changes
- Add native archive support through `reffy plan archive <change-id>`.
- Move completed changes into the existing archive layout under `openspec/changes/archive/`.
- Update current spec state where the archived change modifies or adds capabilities in the compatible spec layout.
- Preserve traceability from Reffy artifacts to archived planning outputs during the archive transition.
- Keep the current `openspec/` layout as the compatibility target during this phase.
- Explicitly defer any `reffyspec/` directory rename or larger metadata redesign.

## Impact
- Affected specs: `planning-archive`
- Affected code: `src/cli.ts`, new archive/runtime helpers, spec merge/update logic, manifest traceability updates, tests for archive behavior against the current `openspec/` layout.

## Reffy References
- `reffyspec-runtime-replacement-plan.md` - defines archive/workflow parity as the next major runtime replacement phase after validation and inspection.
- `reffyspec-refactor-plan.md` - provides the broader runtime replacement and planning subsystem context.
- `decision-note-v1.md` - anchors the v1 subsystem direction that this archive runtime continues.
