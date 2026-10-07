# planning-archive Specification

## Purpose
TBD - created by archiving change add-reffy-native-archive-runtime. Update Purpose after archive.

## Requirements

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
The archive workflow MUST preserve live traceability from Reffy artifacts to archived planning outputs and remove superseded links scoped to the change being archived.

#### Scenario: Archived outputs remain linked to source artifacts
- **WHEN** a change generated from Reffy artifacts is archived
- **THEN** links to files moved by archive point to their dated archived locations
- **AND** unrelated artifact links remain unchanged

#### Scenario: Deleted scaffold output was still linked
- **WHEN** an artifact links to a repository-relative output beneath the active change but that output no longer exists at archive time
- **THEN** archive removes the stale output link during traceability reconciliation
- **AND** the resulting manifest contains only live output links for that change

### Requirement: Complete Documented Delta Application
The archive workflow SHALL apply `ADDED`, `MODIFIED`, `REMOVED`, and `RENAMED` requirement deltas to canonical specs using the same normalized requirement identities accepted by planning validation.

#### Scenario: Removed requirement is archived
- **WHEN** a valid change removes an existing canonical requirement
- **THEN** archive removes the complete requirement block from the resulting canonical spec
- **AND** unrelated requirements remain unchanged

#### Scenario: Requirement is renamed without modification
- **WHEN** a valid change renames an existing canonical requirement with a `FROM` and `TO` pair
- **THEN** archive changes the requirement heading to the destination name
- **AND** preserves the requirement body and scenarios

#### Scenario: Requirement is renamed and modified
- **WHEN** a valid delta renames a requirement and includes a complete modified block under the destination name
- **THEN** archive applies the rename before the modification
- **AND** the resulting canonical spec contains the modified block under the destination name

### Requirement: Mutation-Free Archive Preflight Failure
The archive workflow MUST complete structural validation, delta parsing, canonical-spec compatibility checks, archive destination checks, and traceability reconciliation planning before mutating repository state.

#### Scenario: Structurally invalid change is archived
- **WHEN** archive preflight finds an unexpected path or another structural error
- **THEN** archive exits non-zero with the validation errors
- **AND** it does not move the active change, update canonical specs, or rewrite manifest links

#### Scenario: Semantically invalid delta is archived
- **WHEN** archive preflight finds a malformed, conflicting, or canonically incompatible delta operation
- **THEN** archive exits non-zero with an actionable error
- **AND** it does not move the active change, update canonical specs, or rewrite manifest links
