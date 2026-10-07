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

### Requirement: Exhaustive Active Change Tree Validation
The system MUST validate an active ReffySpec change against the complete supported tree: required top-level `proposal.md`, `tasks.md`, and `specs/`; optional top-level `design.md`; capability directories directly beneath `specs/`; and exactly one `spec.md` file inside each capability directory.

#### Scenario: Supported tree validates without optional design
- **WHEN** an otherwise well-formed active change contains `proposal.md`, `tasks.md`, and one or more `specs/<capability>/spec.md` files but no `design.md`
- **THEN** structural validation succeeds
- **AND** `design.md` is treated as optional

#### Scenario: Unexpected paths are reported together
- **WHEN** an active change contains one or more files or directories outside the supported tree
- **THEN** validation exits non-zero
- **AND** the result identifies every unexpected path found in that validation pass
- **AND** the diagnostics direct durable decisions to `design.md`, checklist work to `tasks.md`, and exploratory context to `.reffy/artifacts/`

#### Scenario: Capability directory contains an extra file
- **WHEN** `specs/<capability>/` contains any entry other than `spec.md`
- **THEN** validation reports that entry as an unexpected change path
- **AND** the change is invalid

### Requirement: Archive-Compatible Delta Validation
The system MUST validate delta syntax and canonical-spec preconditions using the same parsed representation and operation contract used by archive for `ADDED`, `MODIFIED`, `REMOVED`, and `RENAMED` requirements.

#### Scenario: All documented operations satisfy preflight
- **WHEN** a delta contains well-formed documented operations whose names and targets are compatible with the current capability spec
- **THEN** `reffy plan validate` accepts those operations
- **AND** archive preflight can consume the same parsed delta without reporting an unsupported operation

#### Scenario: Delta conflicts with canonical spec state
- **WHEN** an added name already exists, a modified or removed name is absent, a rename source is absent, or a rename destination collides
- **THEN** validation exits non-zero before archive
- **AND** the error identifies the capability, operation, and conflicting requirement name

#### Scenario: Rename syntax is malformed
- **WHEN** a `RENAMED Requirements` section does not contain complete paired `FROM` and `TO` requirement headings
- **THEN** validation exits non-zero
- **AND** the error describes the required `FROM` and `TO` format

#### Scenario: Delta operations conflict with each other
- **WHEN** one delta duplicates an operation or applies incompatible operations to the same normalized requirement name
- **THEN** validation reports every detected conflict
- **AND** the change is invalid
