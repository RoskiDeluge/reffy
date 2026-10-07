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
