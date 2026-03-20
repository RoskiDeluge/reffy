# ReffySpec Refactor Plan

## Context

`refactor-idea.md` argues for inverting the current relationship between Reffy and OpenSpec: instead of treating Reffy as a helper layer, make ideation artifacts the primary source of planning context and make ReffySpec responsible for turning that context into proposals, specs, and task lists.

That direction is sound, but v1 should stay narrow. The main risk is trying to merge two products at the same time as redefining their conceptual boundary. A better first step is to preserve a simple mental model:

- Reffy owns ideation artifacts and artifact indexing.
- ReffySpec owns plan-generation workflows built on top of those artifacts.
- The user should experience them as one integrated Node.js/TypeScript toolchain, even if the implementation is still modular internally.

## Core Recommendations

### 1. Keep artifacts as the system of record

The most valuable part of the refactor is not OpenSpec compatibility. It is making artifact-backed ideation the canonical upstream input to planning. V1 should therefore treat markdown artifacts plus manifest metadata as the durable source of truth for early feature work.

Implication:

- Proposals/specs/tasks should be generated from artifact references instead of existing as disconnected planning documents.

### 2. Avoid a full codebase merger in v1

A literal merge of Reffy and ReffySpec will create migration churn around CLI behavior, directory conventions, tests, and agent instructions. V1 should prefer consolidation at the workflow and data-model layer first.

Practical stance:

- Reuse OpenSpec logic selectively.
- Replace multi-platform abstractions with repo-local Node.js/TypeScript assumptions.
- Keep the implementation boundary clean enough that a deeper merge remains possible later.

### 3. Standardize on one references directory contract

Your artifact mentions `.reffy/artifacts`, while this repo currently uses `.references/artifacts`. V1 needs one canonical location and one manifest contract. The refactor will stay confusing if both concepts survive.

Recommended decision for v1:

- Pick one root, then alias the other temporarily for migration.
- Preserve manifest v1 semantics, but extend entries with planning-oriented metadata only if the additions are clearly optional.

Suggested metadata additions:

- `tags`
- `status`
- `related_changes`
- `derived_outputs`

### 4. Replace harness-specific slash commands with stable CLI verbs

This is the right simplification. Slash commands are transport-specific wrappers, not core product behavior. V1 should define capability in plain CLI terms, then let agent harnesses adapt on top if needed.

High-value command families:

- `reffy artifact *`
- `reffy reindex`
- `reffy validate`
- `reffy summarize`
- `reffy plan *`
- `reffy spec *`

### 5. Treat telemetry removal as a non-goal, not a project theme

Removing telemetry for v1 is sensible, but it should remain a scope limiter rather than a design centerpiece. The real design work is the artifact-to-plan pipeline.

## Proposed V1 Product Shape

### User model

The user writes or collects ideation artifacts first. Reffy indexes them, validates manifest integrity, summarizes relevant context, and then creates planning outputs that cite the source artifacts directly.

### Repository model

- One Node.js/TypeScript CLI
- One references/artifacts directory contract
- One manifest format for indexed artifacts
- One planning pipeline that emits proposals, specs, and tasks derived from artifact context

### Planning flow

1. Add or edit artifacts.
2. Run `reffy reindex`.
3. Run `reffy validate`.
4. Run `reffy summarize --output json` to shortlist relevant inputs.
5. Run a planning command that creates proposal/spec/task scaffolding with explicit artifact references.

## Recommended Execution Plan

### Phase 1: Define the boundary

- Decide whether the canonical directory is `.references/` or `.reffy/`.
- Decide whether ReffySpec is a package, a command group, or a renamed integrated product.
- Write the migration rules for old instructions, manifests, and generated planning files.

Exit criteria:

- No ambiguous terminology across docs or CLI help.

### Phase 2: Unify the data model

- Port the manifest model from Reffy as the base contract.
- Add only the minimum extra metadata needed to connect artifacts to proposals/specs/tasks.
- Document how derived planning outputs refer back to source artifacts.

Exit criteria:

- A single artifact can be traced to generated planning outputs without manual bookkeeping.

### Phase 3: Simplify the CLI surface

- Remove or de-prioritize platform-specific layers from the vendored OpenSpec implementation.
- Convert useful planning functionality into standard Node.js CLI commands.
- Keep command names task-oriented and repo-local.

Exit criteria:

- A user can discover the full workflow from `--help` without reading harness-specific docs.

### Phase 4: Generate planning outputs from artifacts

- Add a planning command that consumes indexed artifacts and produces proposal/spec/task drafts.
- Require a lightweight "Reffy References" section in generated planning outputs.
- Keep generation deterministic enough to be testable.

Exit criteria:

- The same artifact set consistently produces the same references and scaffold structure.

### Phase 5: Remove redundant instruction layers

- Collapse root and nested agent instructions so they describe one integrated workflow.
- Keep only the minimum context needed to guide ideation first, planning second.

Exit criteria:

- Agent entrypoints no longer duplicate the same workflow in multiple places.

## Risks To Watch

- Naming drift between Reffy, ReffySpec, OpenSpec, `.references`, and `.reffy`
- Over-merging too early and inheriting OpenSpec complexity that v1 does not need
- Expanding the manifest before there is a clear query or generation use case
- Building generation commands before the artifact metadata model is stable

## Recommended Immediate Next Step

Before coding the refactor, create a short decision artifact that answers three questions:

1. What is the canonical directory and manifest location?
2. Is ReffySpec a renamed product or a planning subsystem inside Reffy?
3. What minimum planning outputs must v1 generate from artifacts?

That decision note should drive the first OpenSpec proposal. Without it, the refactor will likely blur branding, architecture, and migration into one oversized change.
