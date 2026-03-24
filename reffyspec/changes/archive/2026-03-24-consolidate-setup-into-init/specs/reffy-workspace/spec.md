## MODIFIED Requirements

### Requirement: Canonical Reffy Workspace
The system SHALL treat `.reffy/` as the canonical workspace for Reffy-managed artifacts, manifest data, and managed assistant instructions.

#### Scenario: New repository initialization
- **WHEN** a user runs `reffy init` in a repository that has no existing Reffy workspace
- **THEN** the CLI creates and documents `.reffy/` as the authoritative workspace root
- **AND** manifest-backed artifact operations target `.reffy/` by default
- **AND** the initial setup flow reindexes artifacts and creates the canonical `reffyspec/` planning files needed for project setup

### Requirement: Managed Instruction Consistency
Managed assistant instructions MUST describe the same canonical workspace and planning workflow used by the CLI.

#### Scenario: Instructions are generated or updated
- **WHEN** Reffy writes or refreshes managed instruction content during `reffy init`
- **THEN** the instructions reference `.reffy/` as the canonical workspace
- **AND** the instructions describe planning as an integrated Reffy subsystem rather than a disconnected external workflow

## ADDED Requirements

### Requirement: Canonical Setup Entry Point
The CLI SHALL present `reffy init` as the canonical repository setup command.

#### Scenario: First-run setup guidance is displayed
- **WHEN** a user runs `reffy init` in a fresh repository
- **THEN** the command performs the full setup flow, including artifact reindexing and first-run onboarding guidance
- **AND** the help text and documentation present `init` as the primary onboarding command

#### Scenario: Legacy setup command is used
- **WHEN** a user runs `reffy bootstrap`
- **THEN** the CLI executes the same setup behavior as `reffy init`
- **AND** existing scripts continue to work without requiring immediate migration
