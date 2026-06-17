## MODIFIED Requirements

### Requirement: Managed Skill Scaffolding on Init
`reffy init` SHALL create `.reffy/skills/` and write the built-in managed skills covering the core workflows. Re-running `init` SHALL refresh managed skill bodies in place and SHALL NOT modify or remove unmanaged skills.

#### Scenario: Initial scaffolding
- **WHEN** a user runs `reffy init` in a workspace without a skills directory
- **THEN** `.reffy/skills/` is created
- **AND** the built-in managed skills (`create-artifact`, `create-change`, `archive-change`, `supersede-change`, `inspect-specs`, `sync-remote`, `diagnose`) are written

#### Scenario: Refresh preserves unmanaged skills
- **WHEN** a user has added an unmanaged skill and runs `reffy init` again
- **THEN** managed skill bodies are regenerated in place
- **AND** the unmanaged skill is left unchanged

## ADDED Requirements

### Requirement: Supersede-Change Managed Skill
The built-in managed skill set SHALL include a `supersede-change` skill that recognizes direction-change intent and routes it to the superseding-change procedure. Its frontmatter `triggers` MUST cover pivot, deprecation, wind-down, and reversal language so an agent following skill discovery selects it from natural-language intent.

#### Scenario: Pivot intent matches the skill
- **WHEN** an agent runs `reffy skill list` while handling a request to pivot, deprecate, wind down, or reverse a prior decision
- **THEN** the `supersede-change` skill's triggers match that intent
- **AND** its body directs the agent to identify the prior change-id, author `REMOVED`/`MODIFIED` deltas, fill the `## Supersedes` section of `proposal.md`, validate, and archive

#### Scenario: Superseding never edits the archive
- **WHEN** the `supersede-change` skill body is followed
- **THEN** it instructs landing a new change rather than editing or deleting an archived change
- **AND** it treats the spec delta as the authoritative record and `## Supersedes` as a navigational pointer
