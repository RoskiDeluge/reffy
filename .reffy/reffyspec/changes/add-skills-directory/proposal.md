# Change: Add Reffy Skills Directory

## Why
Reffy makes its *data* surfaces deterministic — artifacts live in `.reffy/artifacts/`, planning truth lives in `.reffy/reffyspec/`, and agent instructions are injected through managed blocks in `AGENTS.md`. It has no deterministic surface for *procedures*. Knowledge of how to actually drive the Reffy CLI is scattered: the managed `AGENTS.md` blocks describe workflows in one-size-fits-all prose that grows stale relative to the CLI, repo-specific conventions live in people's heads, every agent session re-derives the same command sequences from scratch, and users who want to customize Reffy behavior have nowhere structured to put it except hand-editing prose.

A `skills/` directory inside the existing `.reffy/` tree gives procedures the same treatment Reffy already gives data: reusable, named, agent-readable procedures that live as files, are validated by the CLI, and can be authored by both Reffy and the user. A skill answers *how to perform one specific, repeatable task* with the Reffy CLI in this repository — distinct from specs (*what is true*), artifacts (*exploratory thinking*), and `AGENTS.md` blocks (*how to behave in general*).

## What Changes
- Add `.reffy/skills/` to the workspace contract: one directory per skill, each containing a `SKILL.md` entry file plus optional support files.
- Define the `SKILL.md` frontmatter contract: `name`, `description`, `triggers`, `commands`, and `managed` — intentionally compatible with the de facto `SKILL.md`-per-directory convention rather than a Reffy-only schema.
- Scaffold built-in **managed** skills on `reffy init` covering the core workflows: `create-artifact`, `create-change`, `archive-change`, `inspect-specs`, `sync-remote`, `diagnose`. Re-running `init` refreshes managed skill bodies in place and never touches unmanaged skills.
- Add a `reffy skill` command group: `list`, `show <name>`, `create <name>`, `validate [<name>]`, all with `--output json` support.
- Extend `reffy validate` to cover the skills contract (required frontmatter, unique names, kebab-case directory names matching `name`).
- Extend `reffy doctor` to cross-check each skill's `commands` list against the installed CLI's command table and warn on drift.
- Update the managed `AGENTS.md` blocks to route agents through skill discovery instead of inlining procedure detail.
- Document the skills surface and the `reffy skill` command group in `README.md`.

## Impact
- Affected specs: `skills-directory` (new), `reffy-workspace`, `doctor-diagnostics`
- Affected code: `src/cli.ts` (new `skill` command routing), new skills module(s) for scaffolding/parsing/validation, `init` scaffolding, `doctor` and `validate` integration, managed `AGENTS.md` block templates, `README.md`.

## Reffy References
- `reffy-skills-directory.md` — defines the skills-directory motivation, the `SKILL.md` frontmatter contract, the managed/unmanaged split, the `reffy skill` command surface, validation/doctor rules, and the design constraints adopted here.
