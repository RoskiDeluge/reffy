## 1. Implementation
- [x] 1.1 Update `reffy init` to perform the complete first-run setup flow, including reindexing and onboarding output.
- [x] 1.2 Convert `reffy bootstrap` into a compatibility alias for `init` behavior instead of maintaining a separate setup path.
- [x] 1.3 Update CLI usage text and README examples to present `init` as the canonical setup command.
- [x] 1.4 Ensure `reffyspec/project.md` template creation remains part of the unified setup flow.

## 2. Verification
- [x] 2.1 Run `npm run build` and `npm run check`.
- [x] 2.2 Run targeted CLI integration tests covering first-run `init` behavior, idempotent reruns, and `bootstrap` alias compatibility.
- [x] 2.3 Verify text-mode onboarding appears on first-run `init` and does not repeat on idempotent reruns.
