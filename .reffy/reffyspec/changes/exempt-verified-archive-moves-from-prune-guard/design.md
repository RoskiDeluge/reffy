# Design

## Verify each file against the outgoing snapshot

For each planned deletion under `.reffy/reffyspec/changes/<change-id>/<relative-path>`, look for a local outgoing document at `.reffy/reffyspec/changes/archive/<YYYY-MM-DD>-<change-id>/<relative-path>`. Match the complete change ID and full relative path, including nested spec directories. Require identical document content, using the same string comparison as the existing push planner. A previously published archive qualifies if the outgoing snapshot still includes the matching document. A remote-only archive, a different change ID, a different relative path, missing content, or edited content cannot establish a match. Files already under `changes/archive/` are outside the exemption.

The archive command moves the active directory as-is. Earlier edits, such as checking off tasks after the last push, can leave the active remote content different from the archived copy. Evaluate each file independently so those edits count toward the guard while byte-preserving moves qualify. In the 59-document example, up to two unverified deletions pass the guard and three trigger it.

## Use one plan for preview and push

Compute the guard from the number of planned deletions without a verified archive counterpart divided by the selected project's pre-push document count. The denominator includes all documents in that project. Preserve the strict greater-than comparison and the existing empty-project behavior. Keep the complete deletion list and expose the archive moves and the number of deletions counted against the guard in text and JSON. Recompute from the current listing and outgoing snapshot on each invocation.

Use the existing project import with `replace_missing` enabled for an allowed prune, so the payload that removes the stale paths also contains their archive counterparts. This uses the current list-then-import contract and inherits its concurrent-writer window. Preview remains read-only, and guard refusal occurs before registration or import.

## Handle a refused archive cleanup

For each selected workspace, preview pruning and check that every planned deletion belongs to the change just archived and that the guard permits the push. If either check fails, publish with the default keep-missing mode and report the stale paths and the reason cleanup was deferred. If a real prune refuses after a passing preview, use the same fallback. The archive skill continues to prohibit using `--force` for routine cleanup.
