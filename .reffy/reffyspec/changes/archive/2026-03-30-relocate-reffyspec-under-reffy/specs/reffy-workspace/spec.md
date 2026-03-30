## MODIFIED Requirements
### Requirement: Canonical Reffy Workspace
The system SHALL treat `.reffy/` as the canonical workspace for Reffy-managed artifacts, manifest data, managed assistant instructions, and ReffySpec planning files.

#### Scenario: New repository initialization
- **WHEN** a user runs `reffy init` in a repository that has no existing Reffy workspace
- **THEN** the CLI creates and documents `.reffy/` as the authoritative workspace root
- **AND** manifest-backed artifact operations target `.reffy/` by default
- **AND** the initial setup flow creates the canonical `.reffy/reffyspec/` planning files needed for project setup

### Requirement: Managed Instruction Consistency
Managed assistant instructions MUST describe the same canonical workspace and planning workflow used by the CLI.

#### Scenario: Instructions are generated or updated
- **WHEN** Reffy writes or refreshes managed instruction content during `reffy init`
- **THEN** the instructions reference `.reffy/` as the canonical workspace
- **AND** the instructions describe ReffySpec as living under `.reffy/reffyspec/`
