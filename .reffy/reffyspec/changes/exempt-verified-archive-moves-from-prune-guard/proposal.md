# Exempt verified archive moves from the prune guard

## Why

Archiving a change and publishing it leaves stale active paths on the remote until an explicit pruning push removes them. In Durable Forms, the seven stale files for `add-monad-thread` accounted for 7 of 59 remote project documents (11.9%). The 5% guard refused the cleanup, even though the dry run listed only those seven paths and the archived files had already been published. The archive skill directed the agent to stop rather than force the prune.

## What Changes

- Exclude a stale active change file from the 5% calculation when the outgoing snapshot includes a canonical archive counterpart with identical content, the same change ID, and the same change-relative path.
- Count every other planned deletion against the selected project's existing 5% threshold. Keep all planned deletions visible and show which files were verified as archive moves.
- Update the archive skill to check both the deletion paths and the guard result before pruning. If the guard refuses cleanup, publish the archive with a keep-missing push and report the stale paths.

## Impact

- Specs affected include `remote-sync-snapshot-publication` and `skills-directory`.
- Implementation affects the push planner and CLI reporting, the managed archive and remote-sync skills, and remote push regression coverage.
- The existing `--prune` opt-in, project-scoped threshold, and `--force` override continue to apply.

## Reffy References

- [reffy-feedback-prune-guard-blocks-archive-cleanup.md](../../../artifacts/reffy-feedback-prune-guard-blocks-archive-cleanup.md) documents the Durable Forms incident and proposes exempting archive moves.
