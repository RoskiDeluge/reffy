## Context
Reffy now owns the core planning behaviors that previously depended on the external OpenSpec runtime. The repository still keeps the `openspec/` on-disk structure as a compatibility format, and the external `openspec` CLI is still useful as an oracle for validation and regression checks. What is now missing is an explicit declaration that Reffy is no longer merely integrating with OpenSpec, but evolving as its own runtime.

If that declaration remains implicit, several problems follow:

- contributors will not know whether Reffy or OpenSpec is the conceptual source of truth
- future refactors may accidentally optimize for upstream imitation instead of Reffy's own product direction
- the project may hesitate to make clean decisions because it still feels like a downstream wrapper
- a future rename or format migration could be attempted without a stable independence story

## Goals / Non-Goals
- Goals:
  - Declare Reffy to be the primary runtime and planning authority for this project.
  - Clarify the role of OpenSpec as compatibility infrastructure instead of product authority.
  - Document which planning commands and workflows are now natively owned by Reffy.
  - Establish the conditions for any future dependency minimization, removal, or rename work.
- Non-Goals:
  - Rename `openspec/` to `reffyspec/`.
  - Rebuild every OpenSpec feature that Reffy does not use.
  - Introduce a broad metadata redesign or archive-history redesign.
  - Remove every external compatibility hook in the same change.

## Decisions
- Decision: Declare Reffy to be the primary planning/runtime system for this project.
  - Rationale: The native Reffy command surface now covers scaffold generation, validation, inspection, and archive lifecycle behavior.
- Decision: Treat the `openspec/` directory layout and external `openspec` CLI as compatibility infrastructure during transition, not as product authority.
  - Rationale: Compatibility remains useful, but it should no longer define the conceptual center of the project.
- Decision: Preserve Option A behaviorally, but state it more boldly as project independence rather than just dependency minimization.
  - Rationale: The product question is now bigger than package dependency hygiene.
- Decision: Defer rename work until after independence is explicit and stable.
  - Rationale: Directory renames are downstream consequences of boundary clarity, not substitutes for it.

## Recommended Direction
Declare independence now, while preserving compatibility intentionally.

This is consistent with the work already completed:
- scaffold generation is native
- validation is native
- plan/spec inspection is native
- archive behavior is native

That means the repository can now support the following stance:

- Reffy owns the runtime.
- Reffy owns the day-to-day developer workflow.
- OpenSpec remains a useful compatibility oracle and file-format bridge.
- OpenSpec no longer defines the product boundary of Reffy.

## Risks / Trade-offs
- Native parity may still differ from upstream OpenSpec in niche cases.
  - Mitigation: keep OpenSpec available as a compatibility oracle during transition.
- A bold declaration can outrun the implementation if hidden workflow gaps still exist.
  - Mitigation: explicitly inventory remaining dependency points and describe them as compatibility gaps, not as proof that Reffy is subordinate.
- The project may overreact and combine independence with premature format renames.
  - Mitigation: separate independence, dependency minimization, and directory rename into distinct decisions.

## Migration Plan
1. Inventory every remaining place where the repository, docs, tests, or workflows assume direct use of `openspec`.
2. Reclassify those dependency points as compatibility concerns instead of default runtime authority.
3. Update docs and proposal language so Reffy is described as the primary runtime.
4. If needed later, follow with a separate implementation change to minimize or remove the remaining compatibility dependency points.

## Inventory Summary
Current audit result:

- Compatibility/testing only:
  - `openspec/` directory layout in code and docs
  - strict `openspec validate ...` usage in proposal verification and compatibility comparison
  - optional doctor check for `openspec` availability
  - `openspec/AGENTS.md` as a format/workflow conventions file for this repository
- Optional utility:
  - direct manual use of the external `openspec` CLI when contributors want parity comparison or migration confidence
- Unresolved runtime gaps:
  - none identified for the normal local planning lifecycle after phases 1 through 4

This means the remaining OpenSpec dependency is operationally real but no longer architecturally primary.

## Open Questions
- Are there any normal developer workflows in this repo that still require invoking `openspec` directly rather than `reffy`?
- Should the external `openspec` CLI remain part of recommended verification even after Reffy is declared independent?
- When the time comes, should the project preserve `openspec/` as a compatibility export surface or replace it entirely?
