## 1. Implementation
- [x] 1.1 Make `reffy remote init` output and saved linkage behavior deterministic for both provisioned and existing-actor flows.
- [x] 1.2 Tighten `reffy remote status` so it reports local identity, remote identity, linkage, reachability, and remote counts clearly in both text and json modes.
- [x] 1.3 Confirm and harden the default prune semantics for `reffy remote push`, including clear reporting of created, updated, deleted, and imported counts.
- [x] 1.4 Improve actionable failure messages across `remote init|status|push|ls|cat` for the documented step-1 failure cases.
- [x] 1.5 Verify that `remote ls` and `remote cat` provide sufficient remote-debugging coverage without requiring direct backend API use.
- [x] 1.6 Update the helper script and README examples to make the minimal `PASEO_ENDPOINT` requirement and saved linkage flow explicit.
- [x] 1.7 Add or update tests that exercise the hardened remote diagnostics and failure behavior.

## 2. Verification
- [x] 2.1 Run `reffy plan validate harden-remote-sync-step1`.
- [x] 2.2 Run `npm run check`.
- [x] 2.3 Run `npm test`.
- [x] 2.4 Verify a fresh-provision path works with only `PASEO_ENDPOINT` configured.
- [x] 2.5 Verify `remote status` surfaces identity mismatch and unreachable-backend failures clearly.
- [x] 2.6 Verify `remote push` reports prune/delete behavior clearly when local and remote state diverge.
