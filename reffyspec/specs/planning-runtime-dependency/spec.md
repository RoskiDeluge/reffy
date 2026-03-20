# planning-runtime-dependency Specification

## Purpose
TBD - created by archiving change refactor-reffy-runtime-dependency-boundary. Update Purpose after archive.

## Requirements
### Requirement: Explicit Runtime Independence Declaration
The project SHALL explicitly declare Reffy to be the primary planning/runtime authority once native scaffold, validation, inspection, and archive behavior exist.

#### Scenario: Phase 5 independence is reviewed
- **WHEN** maintainers review the Reffy planning/runtime architecture after native scaffold, validation, inspection, and archive support exist
- **THEN** Reffy is explicitly described as the primary runtime authority
- **AND** the project no longer relies on implicit assumptions that OpenSpec remains conceptually primary
### Requirement: Compatibility Boundary Clarity
The project MUST document the remaining role of the external `openspec` CLI and `openspec/` layout as compatibility infrastructure before any future dependency minimization or rename work proceeds.

#### Scenario: Future runtime changes are proposed
- **WHEN** a follow-up change proposes reducing or removing the external OpenSpec dependency
- **THEN** the proposal can point to an explicit list of workflows already owned by Reffy
- **AND** remaining gaps, if any, are described as compatibility follow-up work rather than hidden authority assumptions
