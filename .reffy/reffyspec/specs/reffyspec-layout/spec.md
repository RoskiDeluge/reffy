# reffyspec-layout Specification

## Purpose
TBD - created by archiving change refactor-canonicalize-reffyspec-layout. Update Purpose after archive.

## Requirements

### Requirement: Canonical ReffySpec Layout
The project SHALL use `.reffy/reffyspec/` as the canonical on-disk layout for planning changes and current specs.

#### Scenario: New planning workspace is used
- **WHEN** a user creates, inspects, validates, or archives planning work through Reffy
- **THEN** the planning/spec files live under the canonical `.reffy/reffyspec/` layout
- **AND** the normal workflow no longer treats the top-level `reffyspec/` directory as the primary on-disk path
### Requirement: One-Time Planning Layout Migration
The system SHALL provide a deterministic migration path for repositories that still store planning files under the top-level `reffyspec/` layout.

#### Scenario: Existing repository uses the previous planning layout
- **WHEN** a repository still contains planning files under `reffyspec/`
- **THEN** Reffy migrates or guides migration to `.reffy/reffyspec/`
- **AND** the repository's planning lifecycle continues to work after the migration
### Requirement: Native ReffySpec Guidance
The project MUST use the nested ReffySpec path in normal documentation and managed guidance after the layout change.

#### Scenario: Contributor reads project guidance
- **WHEN** a contributor reads AGENTS instructions, docs, or scaffold guidance after the migration
- **THEN** ReffySpec is presented as the planning/spec surface inside `.reffy/`
- **AND** the previous top-level `reffyspec/` path is mentioned only where migration or historical context explicitly requires it
