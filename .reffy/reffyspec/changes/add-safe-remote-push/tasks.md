## 1. Implementation
- [x] 1.1 Add a push-plan helper in `src/remote.ts` that classifies local vs. remote project documents into add, update, unchanged, and delete by path and content.
- [x] 1.2 Parse `--dry-run`, `--prune`, and `--force` for `reffy remote push` in `src/cli.ts`; reject `--force` without `--prune`.
- [x] 1.3 Change the push handler to list remote project documents, compute the plan, and import with `replace_missing=false` unless `--prune` is set.
- [x] 1.4 Implement the mass-deletion guard (more than 5% of the project's remote documents) that refuses before registration or import unless `--force` is set, listing the would-be-deleted paths.
- [x] 1.5 Implement `--dry-run` so it prints the plan and exits without registering, importing, or updating `last_imported_at`.
- [x] 1.6 Update text and JSON push output with the mode, plan counts, kept remote-only paths, and deleted paths.
- [x] 1.7 Update `reffy remote` help text and the `sync-remote` skill (managed template and `.reffy/skills/sync-remote/SKILL.md`) to describe the new flags and default.
- [x] 1.8 Add a changelog entry noting the breaking default change.

## 2. Verification
- [x] 2.1 Add tests: default push keeps remote-only documents and reports them; `--prune` deletes them; `--dry-run` issues no mutating requests; guard refuses above threshold and `--force` overrides; `--force` without `--prune` fails.
- [x] 2.2 Run `pnpm build`, `pnpm check`, and `pnpm test`.
- [x] 2.3 Run `reffy plan validate add-safe-remote-push`.
- [x] 2.4 Smoke-test `reffy remote push --dry-run` against the `nuveris-v1` workspace.
