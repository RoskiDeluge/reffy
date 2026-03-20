## ADDED Requirements
### Requirement: Artifact-Driven Planning Generation
The system SHALL provide a planning workflow that generates OpenSpec-style planning scaffolds from indexed Reffy artifacts.

#### Scenario: Generate planning scaffolds from artifacts
- **WHEN** a user invokes the planning generation workflow against indexed artifacts
- **THEN** the system produces planning scaffolds derived from the selected artifact context
- **AND** the generated outputs are suitable for use within the repository's OpenSpec change workflow

### Requirement: Minimum V1 Planning Outputs
The planning subsystem SHALL generate, at minimum, a proposal scaffold, a tasks scaffold, and spec delta scaffolds, plus any required boilerplate needed for managed instructions or manifest-linked planning references.

#### Scenario: V1 planning output set
- **WHEN** the user generates a planning scaffold for a proposed change
- **THEN** the output includes `proposal.md`, `tasks.md`, and one or more spec delta files
- **AND** any required boilerplate needed by the workflow is generated consistently

### Requirement: Artifact Traceability In Generated Plans
Generated planning outputs MUST preserve traceability back to the Reffy artifacts that informed them.

#### Scenario: Generated proposal cites source artifacts
- **WHEN** the system creates planning outputs from indexed artifacts
- **THEN** the generated proposal or equivalent design note includes explicit references to the source artifacts used
- **AND** the traceability format is stable enough for review and automation

### Requirement: Harness-Agnostic Planning UX
The planning subsystem SHALL expose its primary capabilities through stable CLI commands rather than harness-specific slash commands.

#### Scenario: Planning commands are discoverable from CLI help
- **WHEN** a user inspects the CLI help or planning command help
- **THEN** the available planning workflow is expressed as standard command verbs and flags
- **AND** the workflow does not require a harness-specific slash command abstraction
