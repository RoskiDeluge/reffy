# planning-validation Specification

## Purpose
TBD - created by archiving change add-reffy-native-planning-runtime. Update Purpose after archive.

## Requirements
### Requirement: Native Planning Change Validation
The system SHALL provide native validation for active planning changes generated within the repository's OpenSpec-compatible change layout.

#### Scenario: Validate a well-formed change
- **WHEN** a user runs `reffy plan validate <change-id>` for a change with the required files and valid delta spec structure
- **THEN** the command reports the change as valid
- **AND** the command exits successfully

#### Scenario: Report structural validation failures
- **WHEN** a user runs `reffy plan validate <change-id>` for a change missing required files or valid requirement/scenario structure
- **THEN** the command reports actionable validation errors
- **AND** the command exits non-zero
### Requirement: OpenSpec-Compatible Validation Scope
Native validation MUST evaluate the OpenSpec-compatible file and formatting rules required by Reffy's active planning workflow.

#### Scenario: Validate requirement and scenario structure
- **WHEN** a change includes delta specs under `openspec/changes/<change-id>/specs/`
- **THEN** validation checks requirement sections and scenario formatting expected by the compatible planning format
- **AND** the result is suitable for parity comparison against current OpenSpec validation for active project cases
### Requirement: Machine-Readable Validation Output
The validation command SHALL support machine-readable output for automation.

#### Scenario: JSON validation output
- **WHEN** a user runs `reffy plan validate <change-id> --output json`
- **THEN** the command returns structured validation results including status and discovered errors or warnings
- **AND** the output format is stable enough for automated tests
