# Project Context Sync

## Why this artifact
Reffy currently has two different planning surfaces that look authoritative to an agent:

- `.reffy/reffyspec/specs/` is supposed to hold the current truth for each capability
- `.reffy/reffyspec/project.md` is the first project-level context file agents are told to read

That works at initialization time, but it drifts after the project evolves.

`project.md` is scaffolded once and then effectively treated as a static document.
The specs directory, by contrast, is designed to keep changing as changes are archived and truth is merged forward.

Once those two surfaces diverge, agents can get conflicting signals:

- `project.md` may describe old architecture or outdated capability assumptions
- current specs may reflect newer truth that never got folded back into the project-level summary
- agents who correctly follow the guidance to read `project.md` first may start from stale context

So Reffy needs an explicit mechanism for keeping project-level context synchronized with spec-level truth.

## The key distinction
Reffy should not treat `project.md` and `specs/` as two independent sources of truth.

They serve different roles:

- `specs/` is the canonical normative truth for current capabilities
- `project.md` is the project-level synthesis that helps agents orient quickly

That means `project.md` should not compete with the specs.
It should be a derived or partially derived summary layer built from them plus durable repository context that the specs do not try to encode.

## Why drift matters
This is not just a documentation nuisance.

The repo's guidance explicitly tells agents to read `project.md` for project conventions.
If that file falls behind the current specs, then the repo's own onboarding path trains agents on stale assumptions before they inspect the actual current truth.

The more Reffy succeeds as a planning system, the more dangerous this becomes:

- completed changes merge into `specs/`
- architecture and capability boundaries evolve
- the high-level project story changes
- but `project.md` stays frozen unless someone remembers to rewrite it

That is the wrong default.

## What should not happen
The weakest answer is to keep `project.md` fully manual and just tell contributors to remember updating it when specs change.

Why that is weak:

- it relies on discipline instead of system behavior
- it gives no way to detect staleness
- it does not scale as the number of specs grows
- it makes the most agent-visible context file the least trustworthy

Another weak answer is to make `project.md` the real source of truth and expect specs to conform to it.

That is backwards.
Project-level context is a summary surface.
Canonical capability truth belongs in the specs.

## Better framing
Reffy likely needs to model `project.md` as a mixed-ownership document:

- some sections are durable manual context
- some sections are generated or refreshed from current specs

This keeps the file useful without pretending every paragraph can be inferred mechanically.

Examples of likely manual sections:

- purpose
- tech stack
- coding conventions
- testing expectations
- external dependencies

Examples of likely managed or derived sections:

- current capability map
- current planning/runtime boundary
- active architectural truths that are already encoded in canonical specs
- project-level summary of what Reffy currently does and does not promise

## Candidate approaches

### Option 1: Manual updates only
Treat `project.md` as purely human-maintained guidance and document that it should be edited whenever specs change.

Pros:

- minimal implementation cost
- no generation logic

Cons:

- drift is inevitable
- no machine-readable freshness signal
- does not protect agent workflows

Judgment:
Too weak.

### Option 2: Fully generate `project.md` from specs
Regenerate the entire file from canonical specs whenever truth changes.

Pros:

- strong synchronization guarantee
- simple source-of-truth story

Cons:

- loses durable repo-specific context that is not naturally present in specs
- encourages bloated specs that must carry onboarding prose
- makes project context feel generic and unstable

Judgment:
Too aggressive.

### Option 3: Section ownership with managed blocks
Split `project.md` into explicitly hand-authored sections and explicitly managed sections that Reffy can refresh from current specs.

Pros:

- keeps human judgment where it matters
- gives Reffy a safe write surface
- makes freshness enforceable for the parts most likely to drift
- matches the existing managed-block philosophy used in `AGENTS.md`

Cons:

- requires a clear ownership model and templating rules
- generated summaries may still need careful wording

Judgment:
This is the strongest baseline.

### Option 4: Standalone sync command plus stale-state warnings
Add a command such as `reffy project sync` and make archive or validation flows warn when `project.md` appears out of date relative to current specs.

Pros:

- explicit user action is easy to understand
- warnings make drift visible
- can evolve gradually

Cons:

- a command alone does not solve ownership unless the file format is designed for it
- warnings without a managed write surface create friction

Judgment:
Good as part of the solution, but not enough alone.

## Recommended direction
The most defensible model is probably a hybrid:

1. Keep `specs/` as the only canonical source of current capability truth.
2. Treat `project.md` as a project-orientation document with mixed ownership.
3. Add managed sections in `project.md` that Reffy can regenerate from current specs.
4. Add an explicit sync mechanism, likely a dedicated command plus automatic refresh on workflows that merge truth such as archive.
5. Record enough metadata to detect staleness when current specs changed after the last project-context sync.

## What the sync mechanism should likely do
At minimum, the mechanism should:

- inspect current canonical specs under `.reffy/reffyspec/specs/`
- derive a concise project-level summary from those specs
- update only managed sections of `project.md`
- preserve manual sections untouched
- record when the managed projection was last refreshed
- make it obvious when `project.md` no longer reflects current spec truth

## Likely product behavior
If Reffy productizes this well, the behavior probably looks something like:

- `reffy init` scaffolds `project.md` with explicit managed sections rather than a fully manual template
- `reffy plan archive` refreshes the managed project-context sections after canonical specs are updated
- `reffy validate` or `reffy plan validate` warns if `project.md` is stale relative to current specs
- `reffy project sync` gives users an explicit repair and regeneration path

That would make the project-level context file trustworthy again without collapsing it into raw spec text.

## Important design constraint
The goal is not to mirror every requirement from every spec into `project.md`.

The goal is to keep the project-level orientation layer aligned with current truth.
So the sync output should stay summarized and stable:

- enough for agent onboarding
- not a second canonical spec surface
- not a noisy dump of every requirement

## Why this fits Reffy specifically
Reffy already uses managed blocks and explicit filesystem conventions to keep agent-facing surfaces predictable.

So `project.md` synchronization is not an alien feature.
It is the same philosophy applied to another high-leverage file:

- keep human-editable guidance
- mark machine-managed regions clearly
- make important context surfaces deterministic

## Near-term recommendation
Before implementation, this should become a ReffySpec change that defines:

- whether this is a new capability or a modification of existing planning workspace behavior
- the ownership model inside `project.md`
- when sync runs automatically
- how staleness is detected
- which commands enforce or repair synchronization

The artifact-level decision is simpler:

`project.md` should no longer be treated as a static setup artifact.
It should become a maintained projection of current spec truth plus durable manual project context.
