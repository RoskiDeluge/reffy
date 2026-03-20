## 1. Parsing And Validation
- [x] 1.1 Add parsing helpers for active planning changes, including proposal, tasks, and delta spec file discovery.
- [x] 1.2 Implement `reffy plan validate <change-id>` with structural checks for required files and ReffySpec-compatible requirement/scenario formatting.
- [x] 1.3 Add strict-mode behavior for validation where useful and document any intentional gaps from upstream validation.

## 2. Inspection Commands
- [x] 2.1 Implement `reffy plan list` to enumerate active changes with basic task/delta summaries.
- [x] 2.2 Implement `reffy plan show <change-id>` to display the key contents of a generated change in text and JSON modes.
- [x] 2.3 Ensure inspection commands operate against the canonical planning layout without requiring archive support.

## 3. Verification
- [x] 3.1 Add automated tests for valid and invalid generated changes under `reffy plan validate`.
- [x] 3.2 Add automated tests for `reffy plan list` and `reffy plan show`.
- [x] 3.3 Compare representative results against the intended project patterns for parity.
- [x] 3.4 Run the relevant verification checks.
