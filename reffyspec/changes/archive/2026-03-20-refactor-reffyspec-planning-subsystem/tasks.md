## 1. Boundary And Migration
- [x] 1.1 Define the canonical `.reffy/` workspace contract and document how legacy `.references/` repositories are detected and migrated.
- [x] 1.2 Document the role of `.vendor/ReffySpec` as a reference-only fork and define the boundary between vendored source and first-party Reffy implementation.
- [x] 1.3 Update managed instruction templates so ideation and planning flows both point at the canonical workspace and planning subsystem terminology.
- [x] 1.4 Decide whether compatibility with `.references/` is automatic aliasing, explicit migration, or a hybrid transition.

## 2. Data Model And Traceability
- [x] 2.1 Define the minimum manifest-linked metadata needed to trace artifacts to generated planning outputs.
- [x] 2.2 Document how generated proposals, tasks, and spec deltas cite their source Reffy artifacts.
- [x] 2.3 Ensure the v1 data model remains backward-compatible where feasible and clearly versioned where not.

## 3. CLI Planning Surface
- [x] 3.1 Define the initial planning command family and command semantics for generating proposal/spec/task scaffolds.
- [x] 3.2 Remove or de-prioritize harness-specific command concepts from v1 docs and planning UX.
- [x] 3.3 Specify deterministic output behavior suitable for automated testing.

## 4. Documentation And Validation
- [x] 4.1 Update `reffyspec/project.md`, `README.md`, and managed instructions to reflect the `.reffy/` canonical model and planning subsystem boundary.
- [x] 4.2 Add or update spec deltas to cover workspace canonicalization and artifact-driven planning generation.
- [x] 4.3 Run the relevant validation and resolve any issues.
