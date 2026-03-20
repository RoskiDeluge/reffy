# Change: Declare Reffy's Runtime Independence

## Why
Phases 1 through 4 moved the day-to-day planning lifecycle into Reffy:

- `reffy plan create`
- `reffy plan validate`
- `reffy plan list`
- `reffy plan show`
- `reffy spec list`
- `reffy spec show`
- `reffy plan archive`

At this point, the remaining question is no longer whether Reffy can perform the core planning workflow natively. It can. The remaining decision is whether the project is willing to say so clearly and treat Reffy as an independent planning/runtime system rather than an OpenSpec-dependent wrapper.

Without an explicit declaration, the project risks staying conceptually subordinate to OpenSpec even though the runtime center of gravity has already moved into Reffy.

## What Changes
- Declare Reffy to be the primary planning/runtime authority for this project.
- Reposition the external `openspec` CLI and `openspec/` layout as compatibility infrastructure rather than product authority.
- Document the practical boundary between independent Reffy behavior and temporary OpenSpec compatibility.
- Inventory any remaining places where the repository still treats OpenSpec as conceptually or operationally primary.
- Defer any `reffyspec/` directory rename until after this independence boundary is documented and the compatibility strategy remains intentional.

## Impact
- Affected specs: `planning-runtime-independence`
- Affected code: planning/runtime documentation, CLI dependency assumptions, compatibility-test strategy, and any remaining direct reliance on the external `openspec` CLI.

## Reffy References
- `reffyspec-runtime-replacement-plan.md` - defines phase 5 as the point where runtime replacement becomes a product-boundary decision.
- `reffyspec-refactor-plan.md` - provides the broader ReffySpec subsystem direction and compatibility-first migration strategy.
- `decision-note-v1.md` - anchors the v1 constraint that Reffy should own the planning subsystem while preserving a practical migration path.
