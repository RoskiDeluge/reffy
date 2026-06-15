## ADDED Requirements

### Requirement: Skills Directory Layout
The system SHALL define `.reffy/skills/` as part of the workspace contract, where each skill is a directory containing a single `SKILL.md` entry file and optional support files.

#### Scenario: Skill directory shape
- **WHEN** a skill named `create-change` exists
- **THEN** it lives at `.reffy/skills/create-change/SKILL.md`
- **AND** the directory MAY contain additional support files (for example `checklist.md` or `scripts/`)

#### Scenario: Skills are discovered from the filesystem
- **WHEN** Reffy enumerates available skills
- **THEN** it discovers them by scanning `.reffy/skills/` directories
- **AND** it does NOT require any corresponding entry in `.reffy/manifest.json`

### Requirement: SKILL.md Frontmatter Contract
Each `SKILL.md` MUST begin with YAML frontmatter carrying `name`, `description`, and `triggers`, MAY declare `commands`, and MAY set `managed`. `triggers` MUST contain at least one entry. The frontmatter serves as the index so an agent can decide whether to load the body without reading it.

#### Scenario: Valid frontmatter
- **WHEN** a `SKILL.md` declares `name`, `description`, and a non-empty `triggers` list in its frontmatter followed by a markdown body
- **THEN** the skill is recognized as valid
- **AND** `name` matches the kebab-case name of its containing directory

#### Scenario: Missing or empty triggers
- **WHEN** a `SKILL.md` omits `triggers` or declares an empty `triggers` list
- **THEN** the skill is rejected as invalid
- **AND** the diagnostic names the missing or empty `triggers` field

#### Scenario: Commands declaration
- **WHEN** a skill declares a `commands` list naming the CLI commands it wraps
- **THEN** those declared commands are available for staleness checking against the installed CLI

#### Scenario: Managed flag
- **WHEN** a skill sets `managed: true`
- **THEN** the skill is treated as CLI-owned and eligible for refresh on `reffy init`
- **AND** a skill that omits the flag is treated as user-owned and never modified by the CLI

### Requirement: Managed Skill Scaffolding on Init
`reffy init` SHALL create `.reffy/skills/` and write the built-in managed skills covering the core workflows. Re-running `init` SHALL refresh managed skill bodies in place and SHALL NOT modify or remove unmanaged skills.

#### Scenario: Initial scaffolding
- **WHEN** a user runs `reffy init` in a workspace without a skills directory
- **THEN** `.reffy/skills/` is created
- **AND** the built-in managed skills (`create-artifact`, `create-change`, `archive-change`, `inspect-specs`, `sync-remote`, `diagnose`) are written

#### Scenario: Refresh preserves unmanaged skills
- **WHEN** a user has added an unmanaged skill and runs `reffy init` again
- **THEN** managed skill bodies are regenerated in place
- **AND** the unmanaged skill is left unchanged

### Requirement: Skill Command Group
The CLI SHALL provide a `reffy skill` command group with `list`, `show <name>`, `create <name>`, and `validate [<name>]` subcommands. `list` and `show` MUST support `--output json`, emitting a harness-native descriptor shape (`name`, `description`, `triggers`, `commands`, `managed`, `path`) rather than an HTTP/OpenAPI schema.

#### Scenario: List skills
- **WHEN** a user runs `reffy skill list`
- **THEN** the CLI prints each skill's name, description, and managed flag
- **AND** `reffy skill list --output json` emits an array of skill descriptors carrying `name`, `description`, `triggers`, `commands`, `managed`, and `path`

#### Scenario: Show a skill body
- **WHEN** a user runs `reffy skill show create-change`
- **THEN** the CLI prints the `SKILL.md` body for that skill
- **AND** `--output json` returns one skill descriptor with the rendered `body` attached

#### Scenario: Create an unmanaged skill
- **WHEN** a user runs `reffy skill create my-workflow`
- **THEN** the CLI scaffolds `.reffy/skills/my-workflow/SKILL.md` from a template
- **AND** the scaffolded skill is unmanaged

#### Scenario: Validate skills
- **WHEN** a user runs `reffy skill validate`
- **THEN** the CLI checks every skill against the frontmatter contract and reports violations
- **AND** running it with a name validates only that skill

### Requirement: Skills Validation in `reffy validate`
`reffy validate` SHALL extend to the skills contract, enforcing required frontmatter fields, unique skill names, and kebab-case directory names that match each skill's `name`.

#### Scenario: Missing required frontmatter field
- **WHEN** a `SKILL.md` omits a required frontmatter field
- **THEN** `reffy validate` exits non-zero
- **AND** the diagnostic identifies the offending skill and missing field

#### Scenario: Directory name mismatch
- **WHEN** a skill's `name` does not match its containing kebab-case directory name
- **THEN** `reffy validate` reports the mismatch as an error

#### Scenario: Duplicate skill names
- **WHEN** two skills declare the same `name`
- **THEN** `reffy validate` reports a uniqueness violation

### Requirement: Command-Reference Staleness in `reffy doctor`
`reffy doctor` SHALL cross-check each skill's declared `commands` against the command table of the installed CLI and warn when a skill references a command or flag the installed version does not provide.

#### Scenario: Stale command reference
- **WHEN** a skill declares a command in `commands` that the installed CLI does not expose
- **THEN** `reffy doctor` emits a staleness warning naming the skill and the unknown command

#### Scenario: All references current
- **WHEN** every skill's declared commands exist in the installed CLI command table
- **THEN** `reffy doctor` reports no skill staleness warnings

### Requirement: Skill Discovery Wiring in Managed AGENTS.md
The managed `AGENTS.md` blocks SHALL include a stable paragraph directing agents to check `.reffy/skills/` (or run `reffy skill list`) and follow the matching skill before performing a Reffy workflow, keeping the always-loaded instruction surface small.

#### Scenario: Discovery paragraph present after init
- **WHEN** `reffy init` writes or refreshes the managed `AGENTS.md` blocks
- **THEN** the managed block contains the skill-discovery routing paragraph
- **AND** the procedure detail itself lives in the on-demand skill files rather than inline in the block

### Requirement: Skills Are Not a Source of Capability Truth
Skills SHALL reference specs and commands rather than restating capability requirements, and the system SHALL NOT execute skill steps in this version.

#### Scenario: Skill points at a spec instead of restating it
- **WHEN** a skill needs to explain what a capability is
- **THEN** the skill references the relevant spec rather than duplicating its requirements

#### Scenario: No executable steps
- **WHEN** a skill is loaded
- **THEN** it is treated as instructions plus optional support files
- **AND** the CLI does not execute the skill's steps automatically
