# reffy-workspace Specification

## Purpose
TBD - created by archiving change refactor-reffyspec-planning-subsystem. Update Purpose after archive.

## Requirements
### Requirement: Canonical Reffy Workspace
The system SHALL treat `.reffy/` as the canonical workspace for Reffy-managed artifacts, manifest data, and managed assistant instructions.

#### Scenario: New repository initialization
- **WHEN** a user initializes Reffy in a repository that has no existing Reffy workspace
- **THEN** the CLI creates and documents `.reffy/` as the authoritative workspace root
- **AND** manifest-backed artifact operations target `.reffy/` by default
### Requirement: Legacy Workspace Migration Guidance
The system SHALL provide an explicit migration path for repositories that still use `.references/` as the workspace location.

#### Scenario: Legacy repository detected
- **WHEN** Reffy runs in a repository that contains a legacy `.references/` workspace
- **THEN** the user receives deterministic guidance or automated migration behavior for moving to `.reffy/`
- **AND** the resulting workflow avoids ambiguous dual-canonical workspace behavior
### Requirement: Managed Instruction Consistency
Managed assistant instructions MUST describe the same canonical workspace and planning workflow used by the CLI.

#### Scenario: Instructions are generated or updated
- **WHEN** Reffy writes or refreshes managed instruction content
- **THEN** the instructions reference `.reffy/` as the canonical workspace
- **AND** the instructions describe planning as an integrated Reffy subsystem rather than a disconnected external workflow
