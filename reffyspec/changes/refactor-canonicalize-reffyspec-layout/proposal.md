# Change: Canonicalize ReffySpec Naming And Layout

## Why
Phase 5 established that Reffy is the primary planning/runtime authority for this project and that the remaining `openspec/` surface is compatibility-era infrastructure rather than product authority.

That leaves one major inconsistency behind: the runtime is now Reffy-native, but the directory names, file paths, and a portion of the surrounding language still present the planning layer under `openspec/`. As long as that remains true, the project boundary is conceptually clear but operationally branded in the old model.

The next step is therefore not more runtime replacement. It is making the on-disk and documentation model match the architectural reality.

## What Changes
- Make `reffyspec/` the canonical on-disk planning/spec layout.
- Migrate the repository from `openspec/` to `reffyspec/` rather than supporting both layouts long-term.
- Update Reffy runtime behavior, managed instructions, docs, and scaffolds to treat ReffySpec naming as native.
- Remove OpenSpec from normal project guidance except where historical or migration context still needs explicit explanation.
- Stop treating OpenSpec export compatibility as a v1 requirement.

## Impact
- Affected specs: `reffyspec-layout`
- Affected code: CLI path resolution, scaffold generation, runtime inspection/archive logic, managed AGENTS content, docs, tests, and migration behavior for existing repositories.

## Reffy References
- `reffyspec-runtime-replacement-plan.md` - explains why naming migration only makes sense after runtime ownership is established.
- `reffyspec-refactor-plan.md` - frames ReffySpec as the planning subsystem inside Reffy and identifies naming drift as a major source of confusion.
- `decision-note-v1.md` - confirms that the planning subsystem should live inside Reffy and that a lean native implementation is preferred over continued upstream coupling.
