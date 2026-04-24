## 1. Implementation
- [x] 1.1 Update manifest types and validation so `project_id` remains source identity and `workspace_ids` is the canonical workspace membership field.
- [x] 1.2 Add migration behavior for existing manifests that use `workspace_name`, preserving timestamps and artifact metadata.
- [x] 1.3 Update initialization defaults so new manifests create deterministic `project_id` and at least one deterministic `workspace_ids` entry.
- [x] 1.4 Update identity-aware CLI workflows to resolve a selected workspace id and fail clearly when multiple memberships make the target ambiguous.
- [x] 1.5 Refactor remote linkage state to support multiple Paseo targets keyed by workspace id.
- [x] 1.6 Update `remote init`, `remote status`, `remote push`, `remote ls`, and `remote cat` to operate against the selected workspace projection.
- [x] 1.7 Update Paseo provisioning assumptions to target the `reffyRemoteBackend.v2` contract: one source `project_id` provisions one backend actor, and each `workspace_id` is addressed through `/workspaces/{workspace_id}/...` on that actor, with the response envelopes (`source` and `workspace`) validated before use.
- [x] 1.8 Add clear failure and reinitialization guidance when an existing backend actor (for example, a v1 actor that only exposes `workspace_name`) cannot report or validate the selected `workspace_id` under the v2 contract.
- [x] 1.9 Ensure `remote push` publishes the full local `.reffy/` tree, including any newly introduced `.reffy/` planning directories and documents, to the selected Paseo backend target.
- [x] 1.10 Update README and helper-script guidance for source identity, workspace membership, workspace selection, projection-scoped backend actors, and multi-target Paseo publication.
- [x] 1.11 Add or update tests for manifest validation, migration, workspace selection, multi-target linkage, backend identity mismatch, reinitialization guidance, and selected-projection remote push.

## 2. Verification
- [x] 2.1 Run `reffy plan validate refactor-multi-workspace-membership`.
- [x] 2.2 Run `npm run check`.
- [x] 2.3 Run `npm test`.
- [x] 2.4 Verify an older `workspace_name` manifest migrates to `workspace_ids` without losing artifact metadata.
- [x] 2.5 Verify remote commands fail clearly when multiple workspace memberships exist and no target is selected.
- [x] 2.6 Verify `remote push` publishes the expected `.reffy/` documents to the selected Paseo workspace projection.
- [x] 2.7 Verify an old singular-identity backend actor produces clear reinitialization guidance instead of being treated as a valid multi-workspace target.
