## 1. Implementation
- [ ] 1.1 Add remote-sync runtime types for linkage config, snapshot metadata, and normalized remote document records.
- [ ] 1.2 Introduce a Reffy-managed Paseo linkage file under `.reffy/` that stores `provider`, `endpoint`, `pod_name`, and `actor_id` separately from `.reffy/manifest.json`.
- [ ] 1.3 Add or refine a Reffy-owned helper deployment/integration script that can provision or connect to a Paseo `reffyRemoteBackend` actor using manifest identity.
- [ ] 1.4 Document the helper-script environment contract for local use, including `PASEO_ENDPOINT`, optional `PASEO_POD_NAME`, and optional `PASEO_ACTOR_ID`.
- [ ] 1.5 Extend the CLI with `reffy remote init|status|push|ls|cat` and help text that reflects the Paseo-targeted step-1 boundary.
- [ ] 1.6 Implement deterministic local `.reffy/` tree scanning and canonical `.reffy/...` path generation for Paseo payload construction.
- [ ] 1.7 Implement `remote init` to either record an existing Paseo linkage or explicitly provision the pod and actor under user control.
- [ ] 1.8 Implement `remote push` as full workspace import via Paseo `workspace/import` with explicit validation of manifest identity, linkage state, and import response integrity.
- [ ] 1.9 Implement `remote status`, `remote ls`, and `remote cat` against Paseo workspace endpoints with clear actionable failures.
- [ ] 1.10 Update documentation for Paseo linkage behavior, config location, helper script usage, `.env` expectations, and command examples in `README.md`.

## 2. Verification
- [ ] 2.1 Run `reffy plan validate add-remote-sync-snapshot-publication`.
- [ ] 2.2 Run `npm run check`.
- [ ] 2.3 Run targeted automated tests for Paseo config parsing, `.reffy/...` path normalization, and CLI validation/error cases.
- [ ] 2.4 Verify `reffy remote init` does not modify `.reffy/manifest.json` remote identity fields beyond reading `project_id` and `workspace_name`.
- [ ] 2.5 Verify the helper script can provision or connect to a Paseo pod/actor and import the local `.reffy/` tree successfully.
- [ ] 2.6 Verify the helper script works with `.env`-provided Paseo variables and does not require separate `REFFY_PROJECT_ID` or `REFFY_WORKSPACE_NAME` when the manifest is present.
- [ ] 2.7 Verify `reffy remote push` publishes only canonical `.reffy/...` paths and fails on missing identity or missing linkage config.
- [ ] 2.8 Verify `reffy remote status` reports linkage, reachability, workspace summary metadata, and identity mismatches clearly.
