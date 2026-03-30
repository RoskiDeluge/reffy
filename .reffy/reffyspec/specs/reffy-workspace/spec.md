# reffy-workspace Specification

## Purpose
TBD - created by archiving change refactor-reffyspec-planning-subsystem. Update Purpose after archive.

## Requirements

### Requirement: Canonical Reffy Workspace
The system SHALL treat `.reffy/` as the canonical workspace for Reffy-managed artifacts, manifest data, managed assistant instructions, and ReffySpec planning files.

#### Scenario: New repository initialization
- **WHEN** a user runs `reffy init` in a repository that has no existing Reffy workspace
- **THEN** the CLI creates and documents `.reffy/` as the authoritative workspace root
- **AND** manifest-backed artifact operations target `.reffy/` by default
- **AND** the initial setup flow creates the canonical `.reffy/reffyspec/` planning files needed for project setup
### Requirement: Legacy Workspace Migration Guidance
The system SHALL provide an explicit migration path for repositories that still use `.references/` as the workspace location.

#### Scenario: Legacy repository detected
- **WHEN** Reffy runs in a repository that contains a legacy `.references/` workspace
- **THEN** the user receives deterministic guidance or automated migration behavior for moving to `.reffy/`
- **AND** the resulting workflow avoids ambiguous dual-canonical workspace behavior
### Requirement: Managed Instruction Consistency
Managed assistant instructions MUST describe the same canonical workspace and planning workflow used by the CLI.

#### Scenario: Instructions are generated or updated
- **WHEN** Reffy writes or refreshes managed instruction content during `reffy init`
- **THEN** the instructions reference `.reffy/` as the canonical workspace
- **AND** the instructions describe ReffySpec as living under `.reffy/reffyspec/`
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
