# Pivots as Superseding Changes

## Why this artifact
Reffy needs a way to represent a change of direction — a pivot, reversal, deprecation, or fundamental rethink — inside its truth structure, the canonical `specs/` tree. The instinct is to reach for new machinery: a `reffy pivot` command, pivot annotations on requirements, a separate lineage file, a "deprecated" status flag. This artifact argues for the opposite move: **a pivot is not a new kind of object. It is just another change.** The only thing genuinely missing is a lightweight way to *signal* that one change supersedes a prior direction — and even that should reuse what already exists rather than introduce new plumbing.

## What is already settled
This is not starting from zero. Reffy already treats pivots as ordinary changes:

- Every change's `specs/<capability>/spec.md` is a **delta** against canonical truth, using `ADDED | MODIFIED | REMOVED | RENAMED Requirements`.
- A course correction is just a change whose delta is mostly `REMOVED`/`MODIFIED` instead of `ADDED` — scaffold a change, author the delta, pair it with removal tasks, archive it.
- Archived changes accumulate under `changes/archive/<date>-<change-id>/`, so the history of direction is already legible as a dated series of deltas rather than being buried in code commits.

So the *representation* of a pivot is solved. The README "Representing pivots" section says as much. What this artifact adds is a sharper framing and the one open question that framing exposes.

## The sharper framing
Three claims, each of which collapses a tempting-but-unnecessary feature:

1. **Every change is a first-class citizen.** There is no privileged "pivot" object. To signal a change of direction, you make a change. The mechanism that adds a capability is the same mechanism that reverses one.
2. **The archive is an append-only ledger.** Nothing in the history is ever deleted or rewritten. Canonical `specs/` always reflects *current* truth, but the *lineage* of how that truth was reached is preserved as the immutable sequence of archived changes. A pivot does not erase the prior direction from the record; it lands a new delta on top of it.
3. **Supersession must be signaled, not inferred.** Today, if change B reverses change A, the relationship is implicit — you can reconstruct it by reading the deltas, but nothing states "B supersedes A." That implicit link is the only real gap.

The design goal: close that gap with the *least* new surface possible, and have it work uniformly for Reffy's own internal direction changes and for any customer repo Reffy lives within.

## The one open question
**How does a change declare that it supersedes a prior change, without inventing new commands, plumbing, or per-requirement annotations?**

Candidate signaling mechanisms, cheapest first:

### Option 1: Prose convention in `proposal.md`
Add a `## Supersedes` (or a one-line `Supersedes:` reference) section naming the prior `change-id`(s).

- Pros: zero new code; reuses the file every change already has; human- and agent-readable; works in any repo today.
- Cons: not machine-validated; easy to forget; no enforcement that the referenced change exists.

### Option 2: The delta is the signal (no explicit link)
Rely on the fact that a `REMOVED`/`MODIFIED` requirement names exactly what it removes or rewrites. The lineage is recoverable by matching requirement names across archived deltas.

- Pros: nothing to add at all; the truth is already in the deltas.
- Cons: supersession is reconstructed, never stated; a reader cannot see "this change reverses that change" without diffing requirement sets; cross-capability or directional pivots are invisible.

### Option 3: A structured relation (manifest or change metadata)
Record `supersedes: [change-id]` as structured data, mirroring how artifacts already carry `related_changes` / `derived_outputs`.

- Pros: machine-checkable; enables `reffy plan show` / lineage queries.
- Cons: this is exactly the "new plumbing" the idea wants to avoid; adds a validation surface and a place to drift.

### Option 4: Hybrid — prose convention now, validation later
Adopt the `## Supersedes` convention (Option 1) as the contract immediately. If it proves valuable, *later* teach `reffy plan validate` to check that referenced change-ids resolve, and surface them in `reffy plan show`/`list` — without ever requiring a new command or annotation.

## Leaning
Option 4. Start with a `## Supersedes` convention in `proposal.md` because it costs nothing, reuses an existing file, reads naturally to both humans and agents, and works in any customer repo on day one. Let the delta itself (Option 2) remain the *authoritative* record of what changed — the `Supersedes` line is a navigational pointer, not a second source of truth. Only graduate to light validation if real usage shows the prose link is too easy to drop.

This keeps faith with how Reffy already works: canonical `specs/` is current truth, `changes/archive/` is the immutable lineage, and a pivot is just the next change in that lineage that happens to point back at the one it overrides.

## Design constraints to preserve
- **No new command for pivots.** A pivot uses `reffy plan create` / `validate` / `archive` like any other change.
- **No per-requirement "deprecated" flags.** Status lives in the delta verbs (`REMOVED`/`MODIFIED`), not in annotations bolted onto canonical requirements.
- **Canonical `specs/` stays current-truth-only.** It is never a changelog; the changelog is the archive.
- **The archive stays append-only.** Superseding never edits or deletes a prior archived change; it lands a new one.
- **Supersession is a pointer, not a parallel truth.** If a `Supersedes` reference and the delta ever disagree, the delta wins.

## Near-term recommendation
This likely does not need to be a ReffySpec change at all yet — it is mostly a *convention* plus a one-paragraph docs addition to the existing "Representing pivots" guidance. If adopted, the smallest first step is:

1. Document the `## Supersedes: <change-id>` proposal convention alongside the existing pivots guidance.
2. Optionally, much later, scope a small change that teaches `reffy plan validate`/`show` to resolve and display supersession links — only if the convention proves load-bearing.

The deeper point: Reffy already has exactly one primitive for evolving truth — the change. A pivot is not an exception to that primitive; it is the primitive being honest about reversing itself.
