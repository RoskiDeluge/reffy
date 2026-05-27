## 1. Implementation
- [x] 1.1 Update Markdown section extraction in `src/plan.ts` to use a prototype-safe section map for normalized heading keys.
- [x] 1.2 Keep planning signal extraction behavior unchanged for recognized sections after the parser hardening.
- [x] 1.3 Add regression coverage for `reffy plan create` when an indexed artifact contains a heading that normalizes to `constructor`.

## 2. Verification
- [x] 2.1 Run `reffy plan validate fix-plan-heading-prototype-collision`.
- [x] 2.2 Run `npm run check`.
- [x] 2.3 Run the relevant automated tests for planning generation, including the new regression case.
- [x] 2.4 Verify `reffy plan create --output json` succeeds when indexed artifacts include a heading that normalizes to an inherited `Object.prototype` key.
