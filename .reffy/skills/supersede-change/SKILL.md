---
name: supersede-change
description: Create a change that supersedes a prior decision. Use for a pivot, deprecation, wind-down, reversal, abandoning an approach, or requests to change direction, deprecate, wind down, or replace prior behavior.
compatibility: Requires the Reffy CLI and an initialized Reffy workspace.
metadata:
  reffy-managed: "true"
  reffy-commands: '["reffy plan list","reffy plan create","reffy plan validate","reffy plan archive"]'
  reffy-triggers: '["pivot","change direction","deprecate","wind down","reverse the decision","supersede","replace the approach","abandon"]'
---

## When to use this skill
Use this when a request changes direction rather than adding to it: a pivot, deprecation, wind-down, or reversal of a prior decision. A pivot is not a special object — it is an ordinary change that supersedes another. Never edit or delete an archived change to reverse it; land a new change on top. Canonical `specs/` always reflects current truth and the archive stays append-only.

## Steps
1. Run `reffy plan list` to identify the prior change-id(s) whose direction this reverses or replaces.
2. Run `reffy plan create --change-id <kebab-id> --title "<title>"` for the new change.
3. Author the spec delta with `REMOVED`/`MODIFIED` requirements (not `ADDED`) that retire or rewrite the superseded behavior. The delta is the authoritative record of what changed.
4. In `proposal.md`, fill the `## Supersedes` section with the prior change-id(s) — a navigational pointer that keeps the lineage explicit.
5. Pair the change with code-removal / migration tasks in `tasks.md`.
6. Run `reffy plan validate <change-id>`, then `reffy plan archive <change-id>` once shipped.

## Failure modes
- If you find yourself wanting to edit an archived change, stop: model the reversal as a new superseding change instead.
- Leaving `## Supersedes` as "None" on a genuine pivot loses the lineage; name the prior change-id.
- A pivot whose delta only `ADDED`s requirements is probably not actually retiring the old direction — check the canonical spec for what should be `REMOVED`/`MODIFIED`.
