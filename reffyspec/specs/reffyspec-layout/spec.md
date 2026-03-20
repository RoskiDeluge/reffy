# reffyspec-layout Specification

## Purpose
TBD - created by archiving change refactor-canonicalize-reffyspec-layout. Update Purpose after archive.

## Requirements
### Requirement: Canonical ReffySpec Layout
The project SHALL use `reffyspec/` as the canonical on-disk layout for planning changes and current specs.

#### Scenario: New planning workspace is used
- **WHEN** a user creates, inspects, validates, or archives planning work through Reffy
- **THEN** the planning/spec files live under the canonical `reffyspec/` layout
- **AND** the normal workflow no longer depends on `openspec/` being the primary on-disk path
### Requirement: One-Time Planning Layout Migration
The system SHALL provide a deterministic migration path for repositories that still store planning files under `openspec/`.

#### Scenario: Existing repository uses compatibility-era layout
- **WHEN** a repository still contains planning files under `openspec/`
- **THEN** Reffy migrates or guides migration to `reffyspec/`
- **AND** the repository's planning lifecycle continues to work after the migration
### Requirement: Native ReffySpec Guidance
The project MUST use ReffySpec naming in normal documentation and managed guidance after the canonical layout migration.

#### Scenario: Contributor reads project guidance
- **WHEN** a contributor reads AGENTS instructions, docs, or scaffold guidance after the rename
- **THEN** ReffySpec is presented as the normal planning/spec surface
- **AND** OpenSpec is mentioned only where migration or historical context explicitly requires it
