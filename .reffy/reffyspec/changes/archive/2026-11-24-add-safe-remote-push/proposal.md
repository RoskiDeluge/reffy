# Change: Add safe remote push

## Why
`reffy remote push` mirrors whatever `.reffy/` tree is checked out and prunes every remote document the checkout lacks (`replace_missing=true`). When plans live on separate git branches, a routine push from one branch silently deletes another branch's plans; the only signal is a `Deleted: N` count printed after the fact. The RFP in `reffy-remote-rfp-git-checkout-sync.md` documents a real incident (7 documents lost, restored by hand) and ranks "stop silent deletions" as the top priority. This change delivers the CLI-side safety items (CLI-1, CLI-2, CLI-6) that resolve the incident on their own, without waiting for paseo-core.

## What Changes
- **BREAKING:** `reffy remote push` no longer prunes by default. It computes a push plan (adds, updates, unchanged, deletes by path) against the remote project listing and imports with `replace_missing=false` unless `--prune` is passed. Remote-only documents are kept and reported by path.
- Add `--prune` to opt into deleting remote documents that are missing locally.
- Add `--dry-run` to print the push plan and exit without registering, importing, or updating local linkage metadata.
- Add a mass-deletion guard: a pruning push that would delete more than 5% of the project's remote documents is refused before any mutation unless `--force` is also passed; the refusal lists the paths that would have been deleted.
- Text and JSON output include the plan, the mode (`keep_missing` or `prune`), and the list of kept remote-only paths.

Out of scope (follow-up changes): pushing from a git ref (CLI-3), ref unions (CLI-4), divergence reporting in `status` (CLI-5), and all paseo-core work (soft delete, provenance, preview endpoint, atomic imports, branch overlays).

## Impact
- Affected specs: `remote-sync-snapshot-publication`
- Affected code: `src/cli.ts` (push handler, remote flag parsing, help text), `src/remote.ts` (plan computation helper), `.reffy/skills/sync-remote/SKILL.md` and its managed template, tests under `tests/`
- Behavior change for anyone relying on push to remove remote documents: they must now pass `--prune`.

## Supersedes
None

## Reffy References
- `reffy-remote-rfp-git-checkout-sync.md` - RFP describing the branch-sync incident and requested CLI/paseo-core changes
