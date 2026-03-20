# planning-inspection Specification

## Purpose
TBD - created by archiving change add-reffy-native-planning-runtime. Update Purpose after archive.

## Requirements
### Requirement: Native Planning Change Listing
The system SHALL provide a native command to list active planning changes in the repository's OpenSpec-compatible change layout.

#### Scenario: List active changes
- **WHEN** a user runs `reffy plan list`
- **THEN** the command enumerates active change IDs
- **AND** the output includes useful summary information such as task or delta counts when available
### Requirement: Native Planning Change Display
The system SHALL provide a native command to display active planning change content.

#### Scenario: Show an active change
- **WHEN** a user runs `reffy plan show <change-id>`
- **THEN** the command returns readable change content derived from the active change files
- **AND** the output includes enough information to inspect the proposal and related planning artifacts without invoking the external `openspec` CLI
### Requirement: Machine-Readable Inspection Output
The planning inspection commands SHALL support machine-readable output for automation.

#### Scenario: JSON output for change inspection
- **WHEN** a user runs `reffy plan list --output json` or `reffy plan show <change-id> --output json`
- **THEN** the command returns structured inspection data for the active change layout
- **AND** the output format is stable enough for automated tests and parity checks
