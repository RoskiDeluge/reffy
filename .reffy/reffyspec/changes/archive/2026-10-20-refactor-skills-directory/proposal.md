# Change: Align Reffy skills with the Agent Skills standard

## Why
Reffy's built-in procedures have a useful directory structure and concise instructions, but their frontmatter implements a Reffy-specific dialect. A standard minimal skill fails Reffy validation because it lacks triggers; valid YAML descriptions lose content; generated skills contain fields rejected by the upstream reference validator. Passing today's validator therefore does not establish interoperability. Agents using native skill discovery also cannot find `.reffy/skills/` without Reffy-specific routing.

## What Changes
- Accept standard minimal skills and replace the partial parser with YAML parsing and serialization that preserve standard optional fields.
- Generate standard headers, with Reffy extensions under namespaced, string-valued metadata; retain normalized CLI descriptor fields and command-drift checks.
- Add complete standard validation, explicit strict conformance mode, and a compatible migration path for existing skills.
- Strengthen descriptions so they alone support selection; provide locations in discovery output and update managed AGENTS guidance and documentation.
- Add an opt-in native discovery export to `.agents/skills/<name>/`, preserving `.reffy/skills/` as the canonical source and protecting user-authored destinations.
- Add conformance fixtures, a pinned upstream validator check in CI, and representative selection and workflow evaluations.

These changes cover all six high/medium recommendations in the audit's 2026-10-19 follow-up, plus its associated conformance and evaluation coverage. Moving embedded built-ins into standalone packaged source files is excluded as lower priority.

## Impact
- Affected spec: `skills-directory`; revise the existing contract instead of introducing a parallel skills capability.
- Affected code: `src/skills.ts`, skill CLI and generated guidance in `src/cli.ts`, doctor integration, skill and CLI tests, CI, package dependencies, README, and checked-in generated skill headers/instructions.
- Add CLI surfaces: `reffy skill validate [<name>] --standard`, `reffy skill migrate [<name>]`, and `reffy skill export --target agents` with existing repo/output options.
- Existing descriptor keys remain available. Standard optional fields and diagnostics are additive. Legacy custom frontmatter remains readable with deprecation warnings; new output uses the standard contract.
- Native export is explicit and local; ordinary initialization does not start writing into native skill directories. Manifest v1 and artifact identity remain unchanged.

## Supersedes
- `add-skills-directory` — replaces its required-trigger and top-level custom-frontmatter decisions while retaining its procedure, ownership, and CLI model.
- `strengthen-agent-skill-routing` — replaces trigger-dependent routing with description-first discovery while retaining ordered loading and remote intent coverage.

## Reffy References
- `agent-skills-standard-audit.md` — confirmed parser, validation, header, discovery, and portability gaps; all high/medium recommendations and follow-up evidence.
- `assistant-native-skill-installation-paths.md` — canonical-source/native-discovery separation and export ownership constraints.

## Acceptance
Fresh managed and custom scaffolds pass both strict Reffy standard validation and the pinned upstream reference validator. A standard minimal skill loads without Reffy metadata. Existing legacy skills remain usable and have an explicit migration path. Text and JSON discovery provide sufficient descriptions and locations. Explicit native export installs complete, valid skill directories and refuses collisions or edits it does not own.
