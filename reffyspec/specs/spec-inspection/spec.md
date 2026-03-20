# spec-inspection Specification

## Purpose
TBD - created by archiving change add-reffy-native-spec-inspection. Update Purpose after archive.

## Requirements
### Requirement: Native Spec Listing
The system SHALL provide a native command for listing current specs from the repository's OpenSpec-compatible spec layout.

#### Scenario: List current specs
- **WHEN** a user runs `reffy spec list`
- **THEN** the command enumerates available spec IDs from `openspec/specs/`
- **AND** the output includes useful summary information such as requirement counts when available
### Requirement: Native Spec Display
The system SHALL provide a native command for displaying current spec content from the repository's OpenSpec-compatible spec layout.

#### Scenario: Show a current spec
- **WHEN** a user runs `reffy spec show <spec-id>`
- **THEN** the command returns readable current spec content for that capability
- **AND** the output is sufficient for routine spec inspection without invoking the external `openspec` CLI
### Requirement: Machine-Readable Spec Inspection Output
The spec inspection commands SHALL support machine-readable output for automation.

#### Scenario: JSON output for spec inspection
- **WHEN** a user runs `reffy spec list --output json` or `reffy spec show <spec-id> --output json`
- **THEN** the command returns structured spec inspection data
- **AND** the output format is stable enough for automated tests and parity checks
