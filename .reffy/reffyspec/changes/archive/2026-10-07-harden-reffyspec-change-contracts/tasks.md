## 1. Shared planning contracts
- [x] 1.1 Define the exhaustive active-change tree and a reusable enumerator that returns every unexpected path.
- [x] 1.2 Extract a shared delta parser/model for `ADDED`, `MODIFIED`, `REMOVED`, and `RENAMED` operations.
- [x] 1.3 Add shared semantic checks for duplicate/conflicting operations and canonical-spec preconditions.

## 2. Validation
- [x] 2.1 Make `reffy plan validate` reject unknown top-level files and directories, invalid `specs/` entries, and extra capability files with aggregated actionable errors.
- [x] 2.2 Validate rename `FROM`/`TO` pairs and ensure every accepted delta operation passes archive compatibility preflight.
- [x] 2.3 Include structural and semantic failures consistently in text and JSON validation output.
- [x] 2.4 Make `reffy validate` report repository-relative `derived_outputs` entries whose targets are missing or are not files.

## 3. Archive safety and delta application
- [x] 3.1 Run the shared structural, delta, canonical-spec, destination, and traceability preflight before any archive write or move.
- [x] 3.2 Implement deterministic `REMOVED` application against canonical requirement blocks.
- [x] 3.3 Implement `RENAMED` application using `FROM`/`TO` pairs, including rename-then-modify behavior.
- [x] 3.4 Rewrite moved output links and prune missing superseded links scoped to the change being archived.

## 4. Guidance and compatibility
- [x] 4.1 Document the active-change tree as exhaustive in the README, CLI guidance, and generated ReffySpec instructions.
- [x] 4.2 Update managed create/archive skills with placement guidance and the supported rename format.
- [x] 4.3 Add release-note migration guidance for repositories containing undocumented change-local files.

## 5. Verification
- [x] 5.1 Test that a standard scaffold and a scaffold without optional `design.md` validate.
- [x] 5.2 Test rejection of unknown top-level files/directories, invalid `specs/` entries, extra capability files, and aggregation of multiple unexpected paths.
- [x] 5.3 Test syntax, conflicts, preconditions, and archive results for all four delta operations, including rename followed by modification.
- [x] 5.4 Test that structurally or semantically invalid archive attempts leave active files, canonical specs, and manifest links unchanged.
- [x] 5.5 Test missing derived-output validation plus archive rewriting/pruning without changing unrelated links.
- [x] 5.6 Run `pnpm check`, `pnpm test`, and `pnpm build`.
- [x] 5.7 Run `reffy plan validate harden-reffyspec-change-contracts` and review text and JSON output.
