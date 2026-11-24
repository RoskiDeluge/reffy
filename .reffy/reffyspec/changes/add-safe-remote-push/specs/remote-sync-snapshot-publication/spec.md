## MODIFIED Requirements
### Requirement: Snapshot Publication Semantics
`reffy remote push` SHALL publish the full local `.reffy/` tree to the selected remote projection, SHALL keep remote documents that are missing locally unless the user explicitly requests pruning, and SHALL report what changed by path.

#### Scenario: Push reports import results
- **WHEN** a user runs `reffy remote push` with valid manifest identity and remote linkage for a selected workspace id
- **THEN** the CLI scans the full local `.reffy/` tree
- **AND** the CLI publishes the full document set to the selected Paseo workspace import target
- **AND** the payload distinguishes the local source identity from the selected workspace projection identity
- **AND** the command reports import counts such as created, updated, deleted, and imported when available
- **AND** the output states whether the push ran in keep-missing or prune mode

#### Scenario: Default push keeps remote-only documents
- **WHEN** a user runs `reffy remote push` without `--prune`
- **AND** the remote project holds documents whose paths are not in the local `.reffy/` tree
- **THEN** the CLI imports with `replace_missing` disabled
- **AND** those remote documents remain on the remote
- **AND** the output lists each kept remote-only path and explains that `--prune` would delete them

#### Scenario: Pruning push deletes remote-only documents
- **WHEN** a user runs `reffy remote push --prune`
- **AND** the push passes the mass-deletion guard
- **THEN** the CLI imports with `replace_missing` enabled
- **AND** the output lists each deleted path

#### Scenario: Newly introduced Reffy directories are published
- **WHEN** multi-workspace membership introduces or relies on new `.reffy/` directories or planning documents
- **AND** a user runs `reffy remote push` for a selected workspace id
- **THEN** those `.reffy/` paths are included in the snapshot payload when they are part of the local Reffy workspace
- **AND** the selected Paseo backend target receives the updated directory/document set for that workspace projection

#### Scenario: Push response is incomplete
- **WHEN** a remote push response omits required source identity, workspace projection identity, or import metadata
- **THEN** the command fails
- **AND** the CLI does not report the push as a successful synchronization
- **AND** the failure message identifies the missing response detail

## ADDED Requirements
### Requirement: Push Plan Preview
`reffy remote push` SHALL compute a push plan before importing, classifying each path as add, update, unchanged, or delete relative to the selected remote project, and SHALL support a dry run that prints the plan without mutating remote or local state.

#### Scenario: Push computes a plan before importing
- **WHEN** a user runs `reffy remote push`
- **THEN** the CLI reads the remote project's document listing before importing
- **AND** the output includes add, update, unchanged, and delete counts
- **AND** text output lists added and to-be-deleted paths

#### Scenario: Dry run makes no changes
- **WHEN** a user runs `reffy remote push --dry-run`, with or without `--prune`
- **THEN** the CLI prints the push plan for the requested mode
- **AND** the CLI does not register the project, import documents, or delete documents
- **AND** the CLI does not update `last_imported_at` in local linkage state
- **AND** the output states that it was a dry run

#### Scenario: Dry run output is machine-readable
- **WHEN** a user runs `reffy remote push --dry-run --output json`
- **THEN** the JSON payload includes the mode, a `dry_run: true` marker, and arrays of added, updated, and deleted paths

### Requirement: Mass-Deletion Guard
`reffy remote push --prune` SHALL refuse to run when it would delete more than 5% of the selected project's remote documents, unless the user also passes `--force`.

#### Scenario: Pruning push exceeds the deletion threshold
- **WHEN** a user runs `reffy remote push --prune` without `--force`
- **AND** the push plan would delete more than 5% of the project's remote documents
- **THEN** the command fails before registering the project or importing any document
- **AND** the output lists the paths that would have been deleted
- **AND** the output explains that `--force` overrides the guard

#### Scenario: Forced pruning push exceeds the threshold
- **WHEN** a user runs `reffy remote push --prune --force`
- **AND** the push plan would delete more than 5% of the project's remote documents
- **THEN** the push proceeds with pruning
- **AND** the output lists each deleted path

#### Scenario: Force is passed without prune
- **WHEN** a user runs `reffy remote push --force` without `--prune`
- **THEN** the command fails before any network request
- **AND** the output explains that `--force` only applies to pruning pushes
