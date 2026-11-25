---
name: archive-change
description: Archive an implemented and verified ReffySpec change and merge its delta into canonical specs. Use when asked to archive a change, finish shipped work, or merge a completed spec delta.
compatibility: Requires the Reffy CLI and an initialized Reffy workspace.
metadata:
  reffy-managed: "true"
  reffy-commands: '["reffy plan validate","reffy plan archive","reffy spec show","reffy remote push"]'
  reffy-triggers: '["archive change","ship change","plan archive","merge spec"]'
---

## When to use this skill
Use this once a change is implemented and verified and you want to fold its spec delta into canonical truth.

## Steps
1. Confirm every task in `tasks.md` is checked off.
2. Run `reffy plan validate <change-id>` one last time.
3. Run `reffy plan archive <change-id>` to move the change under `changes/archive/<date>-<change-id>/` and merge its delta specs.
4. Verify the merge with `reffy spec show <capability>`.
5. If the workspace is published to a remote (`.reffy/state/remote.json` exists) and the user wants it synced, republish after the archive is committed on the default branch. Archiving moves the change, so a plain push adds the `changes/archive/<date>-<change-id>/` copy and keeps the old `changes/<change-id>/` paths on the remote as stale documents:
   - Run `reffy remote push --dry-run --prune` (add `--workspace-id <id>` for each workspace the manifest lists).
   - Prune only if every path under "Would delete" is under `.reffy/reffyspec/changes/<change-id>/` and the guard reports `pass`. Then run `reffy remote push --prune` for that workspace.
   - If the preview lists paths outside the archived change, the guard refuses the previewed cleanup, or the real prune is refused by the guard, publish with `reffy remote push` without `--prune` for that workspace. Report why cleanup was deferred and list the remote-only paths left in place.

## Failure modes
- Never use `--force` for routine archive cleanup.
- If validation reports an unexpected change path, consolidate durable content into `design.md` or `tasks.md`, or move exploratory content to indexed `.reffy/artifacts/`.
- If archive reports unmerged or conflicting requirements, inspect the delta against the canonical spec before retrying.
- Rename-only entries require paired `FROM: ### Requirement: Old Name` and `TO: ### Requirement: New Name` lines; modifications after a rename use the destination name.
