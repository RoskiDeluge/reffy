# RFP: Branch-Safe Sync Between Git and the Reffy Remote

- **Audience:** reffy-cli and paseo-core maintainers
- **Date:** Nov 24 2026
- **Status:** draft for discussion

## The ask

Make `reffy remote push` safe to run from any git branch. Today the remote ends up matching whichever branch happens to be checked out, so a routine sync from a feature branch deletes plans that live on other branches.

We'd like proposals that, in order of priority:
1. stop silent deletions;
2. let a push read from git refs instead of the working tree;
3. record where each remote document came from.

## What happened

In one workspace, plans are drafted on short-lived `plan/*` branches and merged to `main` later. On Nov 23 2026:

- An MCP server plan was committed on `plan/mcp-server` and pushed to the remote. The remote went to 188 documents.
- A second plan was started on `plan/gpt-6-luna`, cut from `main`, so it didn't contain the first plan.
- Running `reffy remote push` from that branch reported `Deleted: 7`. The first plan's artifact and all six of its change files were removed from the remote.
- We restored them by hand: checking the other branch's files into the working tree, merging its manifest entry, pushing again (back to 193 documents), then resetting the branch.

Nothing in the push output asked before deleting. The deletion was only visible as a count in the summary line, after it had happened.

## Root cause

The push treats the checked-out `.reffy/` tree as the complete truth and mirrors it, deleting anything the remote has that the working tree doesn't. But `.reffy/` lives in git, and git spreads work across branches. A working tree holds exactly one branch, so a mirror of it is a partial view whenever planning is happening on more than one branch at once.

Three things make this easy to hit:
- Branching per plan is the natural git workflow, and the CLI doesn't warn about it.
- Deletions apply immediately, with no preview or confirmation.
- Remote documents don't record which ref or commit they came from, so the remote can't tell a deliberate removal from a branch that's simply behind.

## Requested changes: reffy-cli

| ID | Request | Priority |
|---|---|---|
| CLI-1 | **No silent deletions.** `push` shows a plan first (adds, updates, deletes by path). Deletions are skipped unless the user passes `--prune` or confirms interactively. In non-interactive runs, deletions are skipped and reported. | must |
| CLI-2 | **Dry run.** `reffy remote push --dry-run` prints the same plan and changes nothing. | must |
| CLI-3 | **Push from a git ref.** `--ref <ref>` reads `.reffy/` from git objects (as `git show <ref>:path` would), not the working tree. A configured default ref (for example `main`) lets a push from any checkout publish the same, canonical view. | must |
| CLI-4 | **Union of refs.** `--include-refs 'plan/*'` pushes the union of the base ref and matching branches, so in-flight plans stay visible. A conflict rule is needed when two refs change the same path; see open questions. | should |
| CLI-5 | **Divergence in status.** `reffy remote status` lists remote documents missing from the current checkout, and which local refs contain them, before any push is attempted. | should |
| CLI-6 | **Mass-deletion guard.** Refuse a push that would delete more than a set share of remote documents (for example 5%), unless `--force` is given. | should |

## Requested changes: paseo-core

| ID | Request | Priority |
|---|---|---|
| CORE-1 | **Soft delete.** Deleted documents become tombstones that can be restored for a retention window (for example 30 days), with a restore call the CLI can use. | must |
| CORE-2 | **Provenance on every document.** Store the source ref, commit SHA and import time, so the remote can show where each document came from and the CLI can reason about staleness. | must |
| CORE-3 | **Preview endpoint.** Given a proposed import, return the add / update / delete plan without applying it. This backs CLI-1 and CLI-2 without the CLI re-implementing the diff. | should |
| CORE-4 | **Atomic imports.** An import applies fully or not at all, so an interrupted push never leaves a half-synced workspace. | should |
| CORE-5 | **Branch overlays (exploratory).** Optionally keep per-ref layers over a base layer, so the remote can show "main" and "main plus in-flight branches" without the CLI computing unions. | could |

## Acceptance scenarios

**Pushing from a branch that is missing another branch's plan**
- **Given** the remote holds plan A, which exists only on `plan/a`
- **When** a user runs `reffy remote push` from `plan/b`
- **Then** plan A stays on the remote, and the output lists it as "on remote, not in this checkout (found on `plan/a`)"

**Intentional removal**
- **Given** a plan was deleted on `main`
- **When** the user runs `reffy remote push --ref main --prune`
- **Then** the plan becomes a tombstone on the remote and can be restored within the retention window

**Same result from any checkout**
- **Given** a default ref of `main`
- **When** the same user pushes from `main`, from `plan/b`, and from a detached worktree
- **Then** the remote ends up identical each time

**Guard against mistakes**
- **Given** a push would delete 40 of 190 remote documents
- **When** it runs without `--force`
- **Then** it stops before changing anything and prints the paths it would have deleted

## Suggested order

1. **Safety first:** CLI-1, CLI-2 and CLI-6, with CORE-1. Small, and stops the data loss on its own.
2. **Git-aware pushes:** CLI-3 and CLI-5, with CORE-2 and CORE-3. Makes the remote's contents independent of the checkout.
3. **In-flight visibility:** CLI-4, then CORE-5 if unions in the CLI prove awkward.

## Open questions for proposers

- When two refs change the same path (CLI-4), which version wins: newest commit, base ref, or both kept under per-ref names?
- How does `manifest.json` merge across refs, given that artifact ids and derived outputs differ per branch?
- Should a push from a ref that's behind its upstream warn, or fetch first?
- Can CORE-2's provenance be added without a remote schema migration for existing workspaces?

## Workaround in use today

Before pushing, check for `.reffy` changes that exist only on other branches:

```bash
git diff --name-status HEAD plan/other-branch -- .reffy
```

If anything shows up:
- push from a temporary working copy that combines both branches; or
- merge the plan branches to `main` first, and push from there.

Treat any unexpected `Deleted: N` above zero as a stop-and-restore signal. It works, but it relies on people remembering.

Proposals can address any subset. The safety items alone would resolve the incident above.
