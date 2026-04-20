# remote-sync-snapshot-publication Specification

## Purpose
TBD - created by archiving change add-remote-sync-snapshot-publication. Update Purpose after archive.

## Requirements

### Requirement: Remote Command Surface
The CLI SHALL expose a step-1 `reffy remote` command group for linking, publishing, and inspecting a remote `.reffy/` workspace representation.

#### Scenario: Remote help is displayed
- **WHEN** a user requests CLI help for Reffy remote functionality
- **THEN** the CLI documents `remote init`, `remote status`, `remote push`, `remote ls`, and `remote cat <path>`
- **AND** the help text presents the feature as a narrow local-to-remote publication workflow rather than bidirectional sync
### Requirement: Manifest-Backed Workspace Identity
Identity-aware remote workflows SHALL read local workspace identity from `.reffy/manifest.json`.

#### Scenario: Identity-aware remote command runs with valid manifest identity
- **WHEN** a user runs an identity-aware remote command and the manifest includes `project_id` and `workspace_name`
- **THEN** the CLI uses those manifest fields as the local workspace identity
- **AND** the CLI does not require duplicate identity values from environment-only configuration

#### Scenario: Identity-aware remote command runs without manifest identity
- **WHEN** a user runs `reffy remote init`, `reffy remote status`, or `reffy remote push`
- **AND** `.reffy/manifest.json` lacks `project_id` or `workspace_name`
- **THEN** the command fails with an actionable error
- **AND** the error explains that remote sync requires manifest-backed workspace identity
### Requirement: Separate Remote Linkage State
The system SHALL store remote connection metadata separately from `.reffy/manifest.json`.

#### Scenario: Remote linkage is initialized
- **WHEN** a user runs `reffy remote init` with valid linkage inputs
- **THEN** Reffy writes a remote linkage file under `.reffy/`
- **AND** the linkage file stores Paseo connection details such as `endpoint`, `pod_name`, and `actor_id`
- **AND** `.reffy/manifest.json` remains the source of workspace identity rather than deployment linkage

#### Scenario: Remote linkage is missing
- **WHEN** a user runs `reffy remote status`, `reffy remote push`, `reffy remote ls`, or `reffy remote cat <path>` without configured linkage
- **THEN** the command fails clearly
- **AND** the output tells the user to initialize or repair the remote linkage configuration
### Requirement: Paseo Provisioning Path
The first implementation SHALL keep the fresh-provision connection model minimal and explicit.

#### Scenario: Fresh provision uses only endpoint configuration
- **WHEN** a user provisions a new remote backend actor through Reffy
- **AND** `PASEO_ENDPOINT` is configured
- **THEN** Reffy can create the needed pod and actor without requiring separate env-provided workspace identity
- **AND** the resulting linkage is written to local Reffy state for later commands

#### Scenario: Init reports created versus reused linkage
- **WHEN** a user runs `reffy remote init`
- **THEN** the command output indicates whether the pod and actor were newly created or reused
- **AND** the output identifies the saved linkage path and the workspace identity used
### Requirement: Snapshot Publication Semantics
`reffy remote push` SHALL behave as an explicit "remote reflects local" operation for step 1.

#### Scenario: Push reports import and prune results
- **WHEN** a user runs `reffy remote push` with valid manifest identity and remote linkage
- **THEN** the CLI scans the full local `.reffy/` tree
- **AND** the CLI publishes the full document set to Paseo `workspace/import`
- **AND** the command reports import counts such as created, updated, deleted, and imported when available
- **AND** the output makes the default replace/prune behavior auditable by a human operator

#### Scenario: Push response is incomplete
- **WHEN** a remote push response omits required identity or import metadata
- **THEN** the command fails
- **AND** the CLI does not report the push as a successful synchronization
- **AND** the failure message identifies the missing response detail
### Requirement: Canonical Remote Paths
Remote document paths SHALL use canonical workspace paths rooted at `.reffy/`.

#### Scenario: Local files are prepared for remote publication
- **WHEN** Reffy constructs a remote snapshot payload from the local `.reffy/` tree
- **THEN** each document path is represented as a normalized canonical path such as `.reffy/manifest.json`
- **AND** the payload excludes absolute paths, parent-directory traversal, and platform-specific path separators

#### Scenario: User requests a remote document by path
- **WHEN** a user runs `reffy remote cat <path>`
- **THEN** the CLI resolves the request against the normalized logical path namespace
- **AND** the command fails clearly if the requested path is invalid or not found remotely
### Requirement: Remote Inspection and Verification
The system SHALL provide inspection-oriented commands that help users verify local and remote alignment clearly enough for step-1 operational use.

#### Scenario: Remote status succeeds
- **WHEN** a user runs `reffy remote status` against a reachable linked backend
- **THEN** the output includes local workspace identity
- **AND** the output includes remote workspace identity
- **AND** the output includes the saved linkage details used for the connection
- **AND** the output includes remote workspace summary metadata and document counts when available

#### Scenario: Remote endpoint is unreachable
- **WHEN** a user runs `reffy remote status`
- **AND** the configured Paseo endpoint or actor is unreachable
- **THEN** the command fails clearly
- **AND** the output identifies the linkage it attempted to use
- **AND** the output makes it clear that the failure is a reachability problem rather than a local manifest problem

#### Scenario: Remote identity mismatch is detected
- **WHEN** the linked remote workspace identity does not match the local manifest identity
- **THEN** `reffy remote status` or `reffy remote push` fails clearly
- **AND** the output identifies both the local and remote identities instead of silently proceeding
### Requirement: Helper Script Integration
The first implementation SHALL include a supported helper path for validating the Paseo deployment and workspace contract.

#### Scenario: Helper script validates linkage and import
- **WHEN** a user runs the supported Paseo helper script with valid endpoint and identity context
- **THEN** the helper can provision or connect to the target pod and actor
- **AND** the helper can import the local `.reffy/` tree
- **AND** the helper can inspect the resulting workspace and manifest document remotely

#### Scenario: Helper script reads identity from the manifest
- **WHEN** a user runs the supported helper script in a repository with a valid `.reffy/manifest.json`
- **THEN** the helper reads `project_id` and `workspace_name` from the manifest
- **AND** the helper does not require duplicate `REFFY_PROJECT_ID` or `REFFY_WORKSPACE_NAME` values for the common case

#### Scenario: Helper script uses local Paseo environment configuration
- **WHEN** a user runs the supported helper script locally
- **THEN** the helper accepts `PASEO_ENDPOINT` as required configuration
- **AND** the helper accepts `PASEO_POD_NAME` and `PASEO_ACTOR_ID` as optional linkage overrides
### Requirement: Step-1 Boundary
The first remote sync capability SHALL remain one-way and non-collaborative.

#### Scenario: User expects remote-to-local sync features
- **WHEN** a user uses the step-1 remote command set
- **THEN** the available behavior is limited to local linkage, snapshot publication, and remote inspection
- **AND** the CLI does not expose pull, merge, or conflict-resolution workflows as part of the step-1 capability
### Requirement: Remote Debugging Sufficiency
The step-1 command set SHALL be sufficient for routine remote debugging without direct backend API calls.

#### Scenario: User inspects remote state
- **WHEN** a user needs to inspect what exists remotely or read one specific remote document
- **THEN** `reffy remote ls` and `reffy remote cat <path>` provide enough visibility to inspect the linked workspace state
- **AND** the commands fail with clear messages for invalid paths or missing documents
