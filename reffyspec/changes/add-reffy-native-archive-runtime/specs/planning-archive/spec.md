## ADDED Requirements
### Requirement: Native Planning Archive
The system SHALL provide native archive behavior for completed planning changes in the repository's OpenSpec-compatible change layout.

#### Scenario: Archive a completed change
- **WHEN** a user runs `reffy plan archive <change-id>` for a supported completed change
- **THEN** the active change is moved into the archive layout
- **AND** the command exits successfully only when the archive transition is complete

### Requirement: Current Spec Update During Archive
The archive workflow SHALL update current spec state for supported delta patterns affected by the archived change.

#### Scenario: Archive updates current spec state
- **WHEN** an archived change contains supported delta specs
- **THEN** the relevant current spec files under `openspec/specs/` are updated to reflect the archived truth
- **AND** the resulting spec state remains compatible with the repository's planning format

### Requirement: Archive Traceability Preservation
The archive workflow MUST preserve traceability from Reffy artifacts to archived planning outputs.

#### Scenario: Archived outputs remain linked to source artifacts
- **WHEN** a change that was generated from Reffy artifacts is archived
- **THEN** artifact traceability still points to the archived outputs or their equivalent archived locations
- **AND** the archive transition does not orphan the ideation-to-planning links
