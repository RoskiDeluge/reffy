# ReffySpec Runtime Replacement Plan

## Context

The current refactor is no longer just about integrating Reffy with OpenSpec or renaming a vendored fork. The actual goal is to replace the OpenSpec runtime incrementally while preserving compatibility long enough to verify parity and avoid a destabilizing migration.

Today, Reffy can already:

- manage ideation artifacts and manifest metadata
- generate OpenSpec-compatible planning scaffolds from artifacts
- preserve basic traceability from artifacts to generated outputs

But Reffy still depends on the external `openspec` runtime for key behavior:

- validation
- listing changes/specs
- showing change/spec content
- archive/lifecycle workflows

That means ReffySpec is currently a scaffold generator, not yet a full planning runtime.

## Goal

Replace the parts of the OpenSpec runtime that Reffy needs, in phases, while continuing to target the existing `openspec/` directory layout and file format until native parity is proven.

## Non-Goals

- Immediate rename from `openspec/` to `reffyspec/`
- Full feature parity with every upstream OpenSpec command or multi-tool integration
- Preservation of slash-command or harness-specific behavior as a core v1 goal
- Rebuilding the entire vendored project before identifying the minimum runtime surface Reffy actually needs

## Core Strategy

Treat OpenSpec as a compatibility format first, not as the permanent runtime. Reffy should progressively absorb the runtime behaviors it already relies on, in a sequence that keeps testing simple:

1. Keep generating OpenSpec-compatible files.
2. Implement native Reffy commands for the same workflows.
3. Use the external `openspec` CLI as the reference oracle during parity testing.
4. Remove the dependency only after native behavior is demonstrably good enough.

This keeps the migration technically disciplined:

- file format compatibility stays stable
- parity can be tested directly
- branding changes do not get confused with runtime replacement

## Proposed Runtime Replacement Phases

### Phase 1: Scaffold Parity

Status: partially complete

Target:

- `reffy plan create` reliably generates proposal/tasks/spec scaffolds from artifacts
- generated content is meaningfully informed by artifact sections, not just filenames
- manifest traceability links artifacts to generated outputs

Remaining work in this phase:

- improve generated requirement phrasing
- improve multi-artifact synthesis instead of flat bullet carryover
- make generated design/proposal text less boilerplate-heavy

Exit criteria:

- a generated change is consistently valid under `openspec validate <change-id> --strict`
- the generated files visibly reflect the source artifact content

### Phase 2: Validation Parity

Target:

- Reffy can validate generated change/spec structures without shelling out to `openspec`

Native command surface:

- `reffy plan validate <change-id>`
- optionally `reffy plan validate --strict`

Scope:

- required file presence (`proposal.md`, `tasks.md`, delta specs)
- requirement/scenario formatting rules
- directory and naming expectations
- structural errors that `openspec validate` already catches for active workflows

Non-goal for initial pass:

- every niche validation edge case from upstream OpenSpec

Exit criteria:

- Reffy validation matches OpenSpec results for the project’s active changes with no material false positives/negatives

### Phase 3: Read/List/Show Parity

Target:

- Reffy can inspect generated planning artifacts directly

Native command surface:

- `reffy plan list`
- `reffy plan show <change-id>`
- optionally `reffy spec list`
- optionally `reffy spec show <spec-id>`

Scope:

- list active changes
- show proposal/design/tasks/spec delta content
- basic summaries such as task completion counts and delta counts

Exit criteria:

- day-to-day inspection of active planning work no longer requires the external `openspec` CLI

### Phase 4: Archive/Workflow Parity

Target:

- Reffy can manage the basic lifecycle of completed changes

Native command surface:

- `reffy plan archive <change-id>`

Scope:

- move completed change directories to archive
- update current spec state where needed
- preserve traceability from artifact inputs to archived outputs

Risk:

- this phase is more destructive than earlier phases and should happen only after validation/read parity is stable

Exit criteria:

- the full local planning lifecycle can be completed without using the external `openspec` runtime

### Phase 5: Dependency Removal Decision

Target:

- decide whether Reffy still needs OpenSpec as a runtime dependency

Decision options:

- keep OpenSpec only as a compatibility test harness
- make OpenSpec optional
- remove OpenSpec runtime dependency entirely

This is the point where a future `reffyspec/` directory rename would make technical sense, if still desired.

## Recommended Immediate Follow-Up Change

The next formal proposal should focus on **runtime replacement phase 2 and phase 3 only**:

- native validation parity
- native list/show parity

Reason:

- these are the smallest next runtime slices that materially reduce dependency on OpenSpec
- they avoid destructive archive behavior too early
- they clarify whether Reffy is truly becoming a planning runtime or only a better scaffold generator

## Suggested OpenSpec Change Shape

Working change concept:

- `add-reffy-native-planning-runtime`

Likely affected capabilities:

- planning scaffold generation
- planning validation
- planning inspection/listing

Likely command surface:

- `reffy plan create`
- `reffy plan validate`
- `reffy plan list`
- `reffy plan show`

## Key Risks

- confusing compatibility with replacement and ending up with duplicate behavior that diverges
- trying to clone all of OpenSpec instead of replacing only the runtime surface Reffy actually uses
- introducing a native validator that disagrees with OpenSpec too often to trust
- mixing a future naming migration (`openspec/` vs `reffyspec/`) into the same change before runtime parity exists

## Approval Question

Before creating the next OpenSpec proposal, confirm this direction:

Should the next change formally target **native validation and list/show parity against the existing OpenSpec runtime**, while explicitly deferring archive parity and any `reffyspec/` directory rename until later?
