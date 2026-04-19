## 1. Implementation
- [x] 1.1 Extend the manifest types and default manifest creation flow to support `project_id` and `workspace_name` without dropping `created_at` or `updated_at`.
- [x] 1.2 Update manifest validation to accept the identity fields when present and return actionable errors for invalid values.
- [x] 1.3 Add migration behavior for existing manifests that lack the identity fields.
- [x] 1.4 Update identity-aware CLI/runtime flows to read workspace identity from `.reffy/manifest.json`.
- [x] 1.5 Document the manifest identity contract and examples in `README.md` and any relevant CLI help text.

## 2. Verification
- [x] 2.1 Run `reffy plan validate add-manifest-identity-fields`.
- [x] 2.2 Run `npm run check`.
- [x] 2.3 Verify a fresh workspace creates a manifest that includes `version`, `created_at`, `updated_at`, `project_id`, `workspace_name`, and `artifacts`.
- [x] 2.4 Verify older manifests without identity fields can still be read and upgraded through the intended migration path.
- [x] 2.5 Verify invalid manifest identity values fail with actionable validation output.
