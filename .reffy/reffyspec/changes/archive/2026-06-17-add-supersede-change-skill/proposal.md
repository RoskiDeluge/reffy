# Change: Add supersede-change managed skill

## Why
The `skills-directory` capability ships managed skills for the core Reffy workflows, but it had no skill for representing a *change of direction* — a pivot, deprecation, wind-down, or reversal. The `## Supersedes` proposal convention and the "Representing Pivots" `AGENTS.md` guidance give a pivot a *representation*, but nothing actively *recognizes* pivot intent in a thread and routes it to that representation. A managed `supersede-change` skill closes that gap: its `triggers` are the recognition surface, and the managed `AGENTS.md` block already instructs agents to consult skills before performing a Reffy workflow.

This change codifies the addition: the canonical `skills-directory` spec enumerates the built-in managed skills, so adding a seventh is a change to canonical truth and must ride the change mechanism rather than a direct spec edit.

## What Changes
- MODIFY the `skills-directory` "Managed Skill Scaffolding on Init" requirement so the enumerated built-in managed skills include `supersede-change`.
- ADD a requirement that the built-in set includes a `supersede-change` skill whose `triggers` cover pivot/deprecation/wind-down/reversal intent and whose body routes to the superseding-change procedure.

## Impact
- Affected specs: `skills-directory` (MODIFIED + ADDED requirements)
- Affected code: `src/skills.ts` (new managed skill in `MANAGED_SKILLS`), `README.md` (six → seven), regenerated `.reffy/reffyspec/AGENTS.md` and `.reffy/skills/supersede-change/SKILL.md`. Already implemented; this change records the canonical-truth delta.

## Supersedes
None

## Reffy References
- `pivots-as-superseding-changes.md` - establishes pivots as ordinary superseding changes and the recognition-vs-representation distinction this skill resolves.
