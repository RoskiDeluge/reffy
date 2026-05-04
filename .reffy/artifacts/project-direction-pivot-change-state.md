# Project Direction Pivot Change State

## Why this artifact
Reffy currently has a clean answer for one planning lifecycle step:

- an active change becomes archived once it is completed and its truth is merged into the current specs

That is not enough when a project with many active or recently relevant change directories pivots in a materially different direction.

In that situation, the problem is not just that one change is done or not done.
The problem is that a whole cluster of changes may still exist, may still be valid historical planning work, but may no longer represent the direction that agents should continue from.

Without an explicit mechanism, the planning surface becomes noisy:

- old changes still look active
- agents may keep extending the wrong line of work
- specs may preserve historical intent without clearly signaling that the intent has been superseded
- a repo can accumulate planning debt even when the team made a deliberate directional decision

## The core distinction Reffy needs
Reffy should distinguish at least three states that are currently too easy to collapse together:

- completed and merged into current truth
- abandoned before becoming current truth
- superseded by a later project direction

These are not the same.

`archive` works for the first case because the change has succeeded and its effect now belongs in current specs.

A project pivot is different:

- many old changes may never have been implemented
- some may be partially implemented
- some may still describe good local ideas, but no longer belong to the governing direction

So a pivot should not be modeled as ordinary archive.

## What should not happen
The weakest answer is to create one more normal change directory whose only job is to hint that the project direction changed.

That is too implicit.

Why it is weak:

- it relies on the agent noticing one special change among many
- it does not alter the status of the older changes that are now misleading
- it keeps the burden on interpretation instead of making lifecycle state explicit
- it does not help list/show/summarize flows explain which changes are no longer part of the active direction

So the answer should not be "just add another change and hope agents infer the rest."

## Better framing
Reffy likely needs a first-class way to mark changes or sets of changes as superseded, deprecated, or retired from active direction without pretending they were completed.

That means the lifecycle model should probably expand from:

- active
- archived

to something more like:

- active
- archived
- superseded
- abandoned

Exact naming can be debated, but the semantic distinction matters more than the label.

## Candidate approaches

### Option 1: Pivot signal as a normal change
Create a new change directory that says the project has pivoted and describes the new direction.

Pros:

- fits the current filesystem model
- low implementation cost
- keeps everything inside existing planning structures

Cons:

- does not change the state of older changes
- remains ambiguous for agents
- creates narrative context, not enforceable lifecycle state
- scales poorly when many old changes should stop guiding planning

Judgment:
Useful as supporting context, but not sufficient as the main mechanism.

### Option 2: Add per-change lifecycle metadata
Allow change directories to declare status such as:

```json
{
  "status": "superseded",
  "superseded_by": "refactor-new-project-direction",
  "reason": "project direction changed after planning review"
}
```

Pros:

- explicit and machine-readable
- gives list/show/summarize commands stronger semantics
- lets agents filter out stale planning lines
- keeps history without confusing it for active intent

Cons:

- requires a metadata model Reffy does not currently have
- raises questions about where that metadata lives
- creates a new lifecycle transition surface beyond archive

Judgment:
This is a strong foundation. Reffy likely needs something close to this.

### Option 3: Add a group-level pivot record
Introduce a repository-level planning artifact or state record that says:

- a directional pivot occurred
- these change ids were superseded by it
- this replacement direction is now authoritative

Pros:

- models the real event directly
- handles many affected changes at once
- gives agents one clear source of truth for "what changed in the planning story"

Cons:

- still needs per-change visibility unless list/show integrates it well
- can become one more document that agents must remember to read if not wired into tooling

Judgment:
Strong when combined with per-change state or inspection support. Weak if used alone.

### Option 4: Move superseded changes into a separate archive class
Keep completed archive behavior, but introduce a distinct place for changes that are no longer active because direction changed.

For example, directionally:

- `.reffy/reffyspec/changes/archive/` for completed history
- `.reffy/reffyspec/changes/superseded/` for retired planning lines

Pros:

- visually obvious in the filesystem
- reduces active-change noise
- makes change state legible even without extra tooling

Cons:

- path alone may not carry enough semantic detail
- needs careful rules around current spec updates
- could be mistaken for successful archive if naming is not explicit

Judgment:
Potentially good, especially if paired with metadata and CLI support.

## Recommended direction
The most defensible model is probably a combination:

1. keep `archive` for completed and truth-merged changes
2. introduce a first-class `superseded` lifecycle state for changes displaced by a later direction
3. allow one directional pivot record to supersede multiple changes at once
4. make CLI inspection commands surface that state clearly

This is better than a single "pivot change" because it changes the status of the affected planning objects themselves.

## Why `superseded` is better than `deprecated`
`deprecated` suggests "still valid, but discouraged for future use."

That is not quite right for many planning pivots.

Often the old change is not merely discouraged.
It is no longer the active route the project should follow.

`superseded` is stronger and more precise:

- it preserves history
- it explains that a newer direction replaced the old one
- it gives agents a reason to stop extending older changes

`abandoned` may still be useful as a separate state for work that was dropped without a replacement direction.

## Implications for current spec truth
This is where Reffy needs to stay disciplined.

A superseded change should not update current specs merely because it once existed.

Only archived/completed changes should merge into current truth automatically.

That means:

- `archive` changes current specs
- `supersede` changes planning state, not current spec truth

This distinction prevents historical planning noise from mutating the canonical spec surface.

## Likely CLI/runtime implications
If this becomes productized, Reffy may need behavior such as:

- `reffy plan supersede <change-id> --by <change-id|pivot-id>`
- `reffy plan pivot <pivot-id>` to create a directional record
- `reffy plan list` grouping active, superseded, abandoned, and archived changes separately
- `reffy plan show <change-id>` surfacing lifecycle status and replacement lineage
- summarization and agent-facing planning guidance that prioritize active direction over superseded work

This does not need to happen all at once.
But the lifecycle model should be explicit enough that agents are not left inferring project direction from folder archaeology.

## Near-term recommendation
The near-term move should likely be:

- keep the current archive model unchanged for completed work
- add a concept of `superseded` changes before adding anything more complicated
- let one pivot event reference multiple superseded change ids
- make inspection commands and any remote planning views expose that state clearly

If Reffy only adds one thing, it should be an explicit supersession mechanism, not just another change directory with advisory prose.

## Main design judgment
Project pivots are a lifecycle event, not just a documentation event.

Reffy should treat them that way.

The system should preserve old planning work, but it should stop presenting superseded changes as if they are still part of the active route forward.
