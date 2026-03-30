# Change: Relocate ReffySpec Under the Reffy Workspace

## Why
The current split between `.reffy/` for artifacts and `reffyspec/` for planning creates an unnecessary top-level distinction in the repository. Nesting ReffySpec inside `.reffy/` would make the workspace boundary clearer and keep Reffy-managed files together under a single canonical root.

## What Changes
- Change the canonical planning layout from `reffyspec/` to `.reffy/reffyspec/`.
- Update initialization, planning, spec inspection, and archive flows to read and write planning files from `.reffy/reffyspec/`.
- Define deterministic migration behavior for repositories that still use the top-level `reffyspec/` layout.
- Update managed guidance and documentation to describe `.reffy/reffyspec/` as the canonical planning location.

## Impact
- Affected specs: `reffyspec-layout`, `reffy-workspace`
- Affected code: CLI setup and planning runtime code, managed instruction templates, docs, and migration helpers

## Reffy References
No Reffy references used.
