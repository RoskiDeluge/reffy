## 1. Layout Migration
- [x] 1.1 Audit runtime code, docs, tests, and templates for canonical `openspec/` path assumptions.
- [x] 1.2 Implement canonical `reffyspec/` path resolution and one-time migration from `openspec/`.
- [x] 1.3 Ensure scaffold generation, validation, inspection, and archive behavior target `reffyspec/`.

## 2. Guidance And Naming
- [x] 2.1 Update AGENTS/templates/docs to use ReffySpec naming in normal guidance.
- [x] 2.2 Remove OpenSpec from normal workflow framing except where migration or historical context explicitly requires it.
- [x] 2.3 Stop treating OpenSpec export compatibility as a required output mode.

## 3. Verification
- [x] 3.1 Add automated tests for one-time migration from `openspec/` to `reffyspec/`.
- [x] 3.2 Add automated tests for native planning/spec lifecycle behavior under `reffyspec/`.
- [x] 3.3 Run `npm run build`, `npm run check`, and `npm test`.
