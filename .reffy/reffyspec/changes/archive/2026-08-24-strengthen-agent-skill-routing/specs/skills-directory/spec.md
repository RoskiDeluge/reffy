## MODIFIED Requirements

### Requirement: Skill Discovery Wiring in Managed AGENTS.md
The managed root `AGENTS.md` Reffy block and managed `.reffy/AGENTS.md` guidance SHALL direct agents through an ordered skill-discovery prerequisite before performing a Reffy workflow: enumerate `.reffy/skills/` (or run `reffy skill list`), match request intent against skill descriptions and triggers, read the selected `SKILL.md`, and then follow that skill before running Reffy commands. The always-loaded instruction surface SHALL recognize common Reffy remote-workspace intent and SHALL keep task procedure details in the on-demand skill files.

#### Scenario: Ordered discovery guidance is present after init
- **WHEN** `reffy init` writes or refreshes the managed `AGENTS.md` content
- **THEN** the root Reffy block and `.reffy/AGENTS.md` describe skill enumeration, intent matching, and selected-skill loading as ordered steps before Reffy commands run
- **AND** the guidance permits either direct filesystem inspection of `.reffy/skills/` or `reffy skill list` for enumeration
- **AND** task procedure detail remains in the selected on-demand `SKILL.md` rather than being duplicated inline

#### Scenario: Remote workspace intent routes to the remote skill
- **WHEN** `reffy init` writes or refreshes the managed root `AGENTS.md` block
- **THEN** the block recognizes remote workspace, remote synchronization, shared-reference publication, and Paseo language as Reffy intent
- **AND** the block directs remote-workspace requests to `.reffy/skills/sync-remote/SKILL.md`
- **AND** the block does not direct the harness to execute a remote mutation merely because the instructions were loaded

#### Scenario: Reinitialization refreshes routing safely
- **WHEN** a repository with existing managed Reffy instructions runs `reffy init` again
- **THEN** Reffy refreshes the ordered discovery and remote routing language in its managed regions
- **AND** unrelated user-authored `AGENTS.md` content remains unchanged

## ADDED Requirements

### Requirement: Remote Sync Skill Intent Coverage
The built-in managed `sync-remote` skill SHALL advertise trigger metadata covering common requests to inspect or publish a Reffy remote workspace, including remote synchronization, remote workspace, Paseo, and shared-reference language.

#### Scenario: Common remote request selects sync-remote
- **WHEN** an agent enumerates skills for a request that mentions a remote workspace, remote sync, Paseo, shared references, or publishing references
- **THEN** the `sync-remote` description and triggers identify it as the matching managed skill
- **AND** the agent can load its `SKILL.md` for the environment, authentication, identity, and publication procedure

#### Scenario: Managed trigger metadata refreshes on init
- **WHEN** `reffy init` runs in a repository with an older managed `sync-remote` skill
- **THEN** Reffy refreshes the managed skill with the current remote intent triggers
- **AND** unmanaged skills remain unchanged
