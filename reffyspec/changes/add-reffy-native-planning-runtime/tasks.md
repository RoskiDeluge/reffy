## 1. Parsing And Validation
- [ ] 1.1 Add parsing helpers for active planning changes, including proposal, tasks, and delta spec file discovery.
- [ ] 1.2 Implement `reffy plan validate <change-id>` with structural checks for required files and OpenSpec-compatible requirement/scenario formatting.
- [ ] 1.3 Add strict-mode behavior for validation where useful and document any intentional gaps from upstream OpenSpec validation.

## 2. Inspection Commands
- [ ] 2.1 Implement `reffy plan list` to enumerate active changes with basic task/delta summaries.
- [ ] 2.2 Implement `reffy plan show <change-id>` to display the key contents of a generated change in text and JSON modes.
- [ ] 2.3 Ensure inspection commands operate against the existing `openspec/` layout without requiring archive support.

## 3. Verification
- [ ] 3.1 Add automated tests for valid and invalid generated changes under `reffy plan validate`.
- [ ] 3.2 Add automated tests for `reffy plan list` and `reffy plan show`.
- [ ] 3.3 Compare representative results against the external `openspec` CLI for parity on active project patterns.
- [ ] 3.4 Run `openspec validate add-reffy-native-planning-runtime --strict`.
