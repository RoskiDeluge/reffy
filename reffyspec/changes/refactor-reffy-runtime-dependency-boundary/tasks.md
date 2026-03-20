## 1. Independence Audit
- [x] 1.1 Inventory remaining direct uses of the external `openspec` CLI in code, docs, and recommended workflows.
- [x] 1.2 Classify each dependency as compatibility/testing only, optional utility, or an unresolved runtime gap.

## 2. Independence Definition
- [x] 2.1 Declare Reffy as the primary planning/runtime authority for v1.
- [x] 2.2 Document which workflows are natively owned by Reffy and which, if any, remain compatibility concerns.
- [x] 2.3 Update proposal/design/docs language so the independence model is explicit instead of implied.

## 3. Follow-Up Direction
- [x] 3.1 Decide whether the next change should minimize the remaining compatibility dependency, remove it, or intentionally preserve it.
- [x] 3.2 Run `openspec validate refactor-reffy-runtime-dependency-boundary --strict`.
