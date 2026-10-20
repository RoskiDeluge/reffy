## 1. Standard parsing and compatibility
- [x] 1.1 Add a YAML parser/serializer and typed standard header, preserving optional fields and Markdown bodies; expose parse diagnostics without hiding valid sibling skills.
- [x] 1.2 Implement complete standard syntax/type/name/length validation and the distinction between compatibility validation and `skill validate --standard`.
- [x] 1.3 Normalize namespaced string-valued Reffy metadata and recognized legacy headers; warn on legacy use and reject conflicting representations.
- [x] 1.4 Preserve command-drift checks and existing descriptor keys; add standard optional fields, absolute locations, and structured diagnostics.
- [x] 1.5 Implement explicit `skill migrate [<name>]`, including batch preflight, body/support-file preservation, no-op repeats, and text/JSON results.

## 2. Standard generation and discovery
- [x] 2.1 Update managed and custom generators to emit standard headers and compatibility notes, with Reffy extensions only in namespaced metadata.
- [x] 2.2 Rewrite all built-in descriptions with purpose and selection conditions, retaining remote and superseding-change intent without mandatory triggers.
- [x] 2.3 Include paths in text discovery and sufficient metadata/locations in JSON without loading bodies into list output.
- [x] 2.4 Update generated AGENTS guidance and README to match description-first selection, standard fields, strict validation, migration, and relative support-file resolution.
- [x] 2.5 Preserve built-in refresh behavior and user-owned files; diagnose built-in-name ownership collisions. Regenerate checked-in managed skills/guidance with the updated generator.

## 3. Optional native discovery
- [x] 3.1 Add `skill export --target agents` and an adapter mapping to `.agents/skills/<name>/`, with standard validation and complete resource copying.
- [x] 3.2 Add versioned export ownership state, containment checks, conflict preflight, local-edit protection, safe refresh/removal, and interrupted-write recovery.
- [x] 3.3 Add text/JSON export results and document explicit re-export after source updates; preserve canonical-only behavior for ordinary init.

## 4. Conformance and behavioral verification
- [x] 4.1 Add parser/validator boundary fixtures, including valid minimal headers, multiline YAML, quoted commas, optional fields, malformed YAML, Unicode names, metadata types, legacy conflicts, and exact length limits.
- [x] 4.2 Add CLI integration coverage for migration, standard scaffolds, default/strict validation, descriptor compatibility, doctor command drift, and managed refresh/user ownership.
- [x] 4.3 Add native-export integration coverage for support-file references, executable permissions, idempotence, source changes/removals, missing targets, collisions, local edits, containment, and failure recovery.
- [x] 4.4 Pin the upstream reference validator to an immutable revision in CI and validate freshly generated managed and custom fixtures; retain offline core operation.
- [x] 4.5 Run and record representative skill-selection and workflow evaluations, including negative prompts, remote intent, and superseding-change intent; smoke-test native discovery/loading in an available client and document any execution limitation.
- [x] 4.6 Run `pnpm build`, `pnpm check`, `pnpm test`, strict conformance checks, `reffy validate`, and `reffy plan validate refactor-skills-directory`; resolve failures before shipping.
