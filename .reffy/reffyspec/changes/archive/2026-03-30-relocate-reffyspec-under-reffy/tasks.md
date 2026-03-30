## 1. Implementation
- [x] 1.1 Change the canonical planning root from `reffyspec/` to `.reffy/reffyspec/` in runtime helpers and scaffolding.
- [x] 1.2 Update `reffy init` and related setup flows to create `.reffy/reffyspec/changes/`, `.reffy/reffyspec/changes/archive/`, and `.reffy/reffyspec/specs/`.
- [x] 1.3 Add deterministic migration or migration guidance for repositories that still use the top-level `reffyspec/` directory.
- [x] 1.4 Update managed `AGENTS.md` guidance and project docs to reference `.reffy/reffyspec/` as canonical.

## 2. Verification
- [x] 2.1 Run `npm run build` and `npm run check`.
- [x] 2.2 Verify `reffy init` creates the nested planning layout in a fresh repository.
- [x] 2.3 Verify planning commands operate correctly against `.reffy/reffyspec/`.
- [x] 2.4 Verify a repository with an existing top-level `reffyspec/` layout receives correct migration behavior or guidance.
