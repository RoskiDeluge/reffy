## 1. Skills directory and SKILL.md contract
- [x] 1.1 Define the `.reffy/skills/` layout (one directory per skill, `SKILL.md` entry file, optional support files) in the workspace contract.
- [x] 1.2 Implement a `SKILL.md` parser for the frontmatter contract: `name`, `description`, `triggers`, `commands`, `managed`.
- [x] 1.3 Add filesystem-based skill discovery (no `manifest.json` entries) keyed on directory name matching `name`.

## 2. Managed skill scaffolding on init
- [x] 2.1 Author the six built-in managed skill bodies: `create-artifact`, `create-change`, `archive-change`, `inspect-specs`, `sync-remote`, `diagnose`.
- [x] 2.2 Make `reffy init` create `.reffy/skills/` and write the managed skills.
- [x] 2.3 Make re-running `init` refresh managed skill bodies in place while never touching unmanaged skills.

## 3. `reffy skill` command group
- [x] 3.1 Add `reffy skill list` (name + description + managed flag) with `--output json`.
- [x] 3.2 Add `reffy skill show <name>` printing the `SKILL.md` body, with `--output json`.
- [x] 3.3 Add `reffy skill create <name>` scaffolding an unmanaged skill from a template.
- [x] 3.4 Add `reffy skill validate [<name>]` checking the frontmatter contract and command references.

## 4. Validation and doctor integration
- [x] 4.1 Extend `reffy validate` to enforce the skills contract: required frontmatter fields, unique names, kebab-case directory names matching `name`.
- [x] 4.2 Extend `reffy doctor` to cross-check each skill's `commands` list against the installed CLI command table and warn on drift.

## 5. Discovery wiring and docs
- [x] 5.1 Update the managed `AGENTS.md` blocks with the stable skill-discovery paragraph.
- [x] 5.2 Document the skills surface and `reffy skill` command group in `README.md`.

## 6. Verification
- [x] 6.1 Run `npm run build` and `npm run check`.
- [x] 6.2 Run `reffy init` in a fresh workspace and verify the six managed skills are scaffolded; re-run and verify managed bodies refresh while an unmanaged skill is untouched.
- [x] 6.3 Run `reffy skill list/show/create/validate` and verify behavior plus `--output json` shapes.
- [x] 6.4 Introduce a skill referencing a non-existent command and verify `reffy doctor` warns on drift and `reffy validate` reports the contract error.
- [x] 6.5 Validate the change with `reffy plan validate add-skills-directory`.
