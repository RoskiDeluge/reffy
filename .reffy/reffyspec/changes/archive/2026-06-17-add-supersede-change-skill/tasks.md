## 1. Implementation
- [x] 1.1 Add the `supersede-change` entry to `MANAGED_SKILLS` in `src/skills.ts` with pivot/deprecation/reversal `triggers` and a body covering the superseding-change procedure.
- [x] 1.2 Update `README.md` managed-skill count and list (six → seven).
- [x] 1.3 Refresh the managed `.reffy/reffyspec/AGENTS.md` block and scaffold `.reffy/skills/supersede-change/SKILL.md` via `reffy init`.

## 2. Verification
- [x] 2.1 Run `npm run build`, `npm run check`, and `npm test` (managed-skill tests key off `MANAGED_SKILLS`).
- [x] 2.2 Verify `reffy skill list` shows `supersede-change`, `reffy skill validate` reports 7, and `reffy doctor` reports no command drift.
- [x] 2.3 Validate the change with `reffy plan validate add-supersede-change-skill`.
