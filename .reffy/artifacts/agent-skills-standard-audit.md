# Agent Skills standard: brief Reffy audit

Audited 2026-09-09 against the live [Agent Skills specification](https://agentskills.io/specification) and accompanying guidance. Local baseline: Reffy CLI 1.9.4, commit `60d3bf5`.

**Assessment:** Reffy has the right directory structure and useful, concise procedures, but its shipped frontmatter and skill utility implement a Reffy-specific dialect. Passing `reffy skill validate` does not establish Agent Skills conformance.

## Scope and evidence

Reviewed [`src/skills.ts`](../../src/skills.ts), the skill CLI in [`src/cli.ts`](../../src/cli.ts), [`test/skills.test.ts`](../../test/skills.test.ts), CI, and all seven `.reffy/skills/*/SKILL.md` files: `create-artifact`, `create-change`, `archive-change`, `supersede-change`, `inspect-specs`, `sync-remote`, and `diagnose`. Built the local source and generated fresh managed skills in a temporary workspace; all seven exactly match the checked-in copies. Packaging ships `dist/`; `reffy init` materializes skills from embedded definitions.

This updates the interoperability assumption in [reffy-skills-directory.md](reffy-skills-directory.md). No implementation changes or remote operations were performed.

## Findings

| Area | Assessment | Evidence and implication |
| --- | --- | --- |
| Basic format | Meets | All seven use matching lowercase kebab-case directories, `SKILL.md`, YAML frontmatter, nonempty names/descriptions within the standard's limits, and Markdown instructions. The specification requires this core structure. [Specification](https://agentskills.io/specification) |
| Custom frontmatter | Falls short | Every shipped skill, and the custom-skill scaffold, emits top-level `triggers`, `commands`, and `managed`. The upstream reference validator rejects these unexpected fields. This is a source-confirmed incompatibility; the upstream validator itself was not executed. [Reference validator](https://github.com/agentskills/agentskills/blob/main/skills-ref/src/skills_ref/validator.py) |
| YAML and standard fields | Falls short | `parseSkillFile` uses line regexes rather than a YAML parser. A folded `description: >` becomes the literal `">"`, losing its content. Standard `license`, `compatibility`, `metadata`, and `allowed-tools` are discarded from parsed records and CLI JSON. The format permits these fields and YAML frontmatter. [Specification](https://agentskills.io/specification) |
| Validation | Falls short | Reffy requires nonempty `triggers`, rejecting a standard minimal skill with only `name` and `description`. Conversely, a fixture with a 65-character name and 1,025-character description passes Reffy validation despite exceeding the 64/1,024 limits. Optional-field types and constraints are not checked. [Specification](https://agentskills.io/specification) |
| Discovery and activation | Partial | `skill list --output json` exposes metadata and location without bodies; `skill show` supplies instructions. AGENTS guidance routes agents through discovery. However, `.reffy/skills/` requires that routing or custom configuration; there is no `.agents/skills/` installation/export bridge. The root location is not mandated by the format, so this is an interoperability gap, not a format violation. [Client guidance](https://agentskills.io/client-implementation/adding-skills-support) |
| Instruction quality | Mostly meets guidance | Files are only 18–29 lines, with task-specific steps and failure modes. Improve discovery by incorporating useful trigger phrases into descriptions; generic clients need not consume Reffy's `triggers`. Add representative examples and skill execution/selection evaluations. Existing skill tests exercise parser/scaffolder mechanics. [Best practices](https://agentskills.io/skill-creation/best-practices) |

Omitted `scripts/`, `references/`, and `assets/` directories are fine: these are optional. `compatibility` would usefully declare the Reffy CLI/workspace dependency; omission is not itself a failure. [Specification](https://agentskills.io/specification)

## Recommended priorities

1. **Align the contract:** use a YAML parser; support and validate standard fields; accept minimal standard skills. Move Reffy extensions into namespaced, string-valued `metadata` or a sidecar. Preserve command-drift checks and managed refresh behavior through an explicit migration; moving lists/booleans unchanged under `metadata` would still violate its string-value contract. [Specification](https://agentskills.io/specification)
2. **Add conformance coverage:** validate freshly generated managed and custom skills against a pinned upstream reference validator in CI. Cover folded YAML, optional metadata, minimal headers, and length boundaries. Current CI runs Reffy's own checks only.
3. **Improve portability and usefulness:** offer a documented discovery/export bridge, strengthen descriptions, and evaluate representative workflows. Preserve Reffy's ownership model and concise procedures.

Verification: `npm run build` passed; fresh generated skills passed Reffy's validator (`7/7`). Temporary fixtures reproduced the three parser/validation failures above. No cross-client execution testing was performed.

## Follow-up review: 2026-10-19

Reviewed the built-in skills again against the linked specification with Reffy CLI package version 1.9.5. Both URLs supplied for this review pointed to the same specification. The recommendations below capture the follow-up discussion; they are exploratory input for a future change, not implemented behavior.

### What to retain

Keep the existing directory structure, filesystem discovery, concise task procedures, and separate list/show commands. The seven checked-in built-ins are now 18–33 lines each. Their size does not justify additional resource files. Keep Reffy's command-drift checks, managed refresh behavior, and AGENTS routing while improving interoperability.

### Recommendations by priority

1. **High: accept standard minimal skills.** `validateSkills` currently requires a nonempty `triggers` list, so a standard skill containing just `name`, `description`, and instructions fails validation. Make triggers optional. Put the essential selection language in each description, including what the skill does and when to use it. Generic clients should be able to select a skill without understanding Reffy extensions. [Frontmatter specification](https://agentskills.io/specification#frontmatter), [description guidance](https://agentskills.io/skill-creation/optimizing-descriptions).

2. **High: generate portable frontmatter.** `renderSkillFile` emits top-level `triggers`, `commands`, and `managed`, which the upstream reference validator rejects as unknown fields. Move retained Reffy extensions under namespaced `metadata` keys with string values, or into a sidecar. Encode lists as strings if kept in metadata; do not move arrays and booleans there unchanged. Preserve the useful CLI descriptor fields and command-drift checks through normalization and migration. [Reference validator](https://github.com/agentskills/agentskills/blob/main/skills-ref/src/skills_ref/validator.py).

3. **High: replace the partial YAML parser.** Use a YAML library for parsing and serialization. The current parser turns a folded description into the literal `">"`, splits quoted list items containing commas, and silently discards standard optional fields. Preserve `license`, `compatibility`, `metadata`, and `allowed-tools` in parsed records and relevant CLI JSON. Report malformed frontmatter clearly; do not equate accepting malformed YAML with standards conformance.

4. **Medium: complete validation.** Enforce the standard's name and description length limits, directory/name agreement, naming rules, and optional-field types and constraints. Include the compatibility length constraint and string-valued metadata. Keep standard conformance checks distinct from any additional Reffy-specific policy. Add boundary and interoperability fixtures to the existing tests; current passing tests establish the custom contract only. [Specification](https://agentskills.io/specification).

5. **Medium: make discovery output sufficient for selection and loading.** Default text `reffy skill list` prints names, descriptions, and managed flags but omits both triggers and locations. Generated AGENTS instructions nevertheless ask agents to match descriptions and triggers. Make descriptions independently sufficient and include file locations in discovery output, or explicitly route machine discovery through `--output json`. Continue exposing full instructions only when a skill is selected. Update the README and generated AGENTS guidance with the revised contract. [Client implementation guidance](https://agentskills.io/client-implementation/adding-skills-support).

6. **Medium: offer optional native discovery integration.** Retain `.reffy/skills/` as the canonical source; the format does not mandate a single installation root. Explore an optional `.agents/skills/` installation/export integration for clients that discover skills there. Preserve existing AGENTS routing and avoid divergent copies or overwriting user-owned skills. See [assistant-native-skill-installation-paths.md](assistant-native-skill-installation-paths.md) for related exploration. This is a portability improvement rather than a file-format requirement.

7. **Lower: consider standalone packaged skill sources as the set grows.** Embedding seven short built-ins in TypeScript is acceptable. Moving them into standalone packaged files could make editing, validation, and distribution easier, but parser and contract compatibility should take precedence.

### Illustrative portable header

```yaml
---
name: create-artifact
description: >-
  Capture ideas, research, and exploratory notes as Reffy artifacts.
  Use when asked to record an idea, add a note, or preserve research
  context before formal planning.
compatibility: Requires the Reffy CLI and an initialized Reffy workspace.
metadata:
  reffy-managed: "true"
  reffy-commands: '["reffy reindex", "reffy validate"]'
---
```

This example keeps discovery language in the description and preserves command declarations as an encoded string. Exact extension names and migration behavior remain design choices.

### Follow-up evidence

- All seven checked-in skills passed the current Reffy validator.
- `vitest run test/skills.test.ts` passed all 12 existing tests.
- Temporary fixtures confirmed that a standard minimal skill without triggers is rejected, a 65-character name with a 1,025-character description is accepted, and malformed YAML with an unquoted `: ` inside a description is accepted.
- A folded description became `">"`; the list item `"capture notes, ideas"` was incorrectly split into two items.
- The upstream validator's rejection of custom top-level fields was confirmed by reading its source; the upstream validator and cross-client workflows were not executed during this follow-up.

Implementation references: [`src/skills.ts`](../../src/skills.ts) (`parseSkillFile`, `validateSkills`, `renderSkillFile`, `MANAGED_SKILLS`), [`src/cli.ts`](../../src/cli.ts) (skill list/show and generated guidance), and [`test/skills.test.ts`](../../test/skills.test.ts). The current local contract is recorded in [the skills-directory spec](../reffyspec/specs/skills-directory/spec.md); adopting these recommendations will require reconciling that contract in a future ReffySpec change.
