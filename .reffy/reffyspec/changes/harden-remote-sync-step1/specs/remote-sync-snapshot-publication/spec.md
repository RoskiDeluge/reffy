## MODIFIED Requirements
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

### Requirement: Remote Debugging Sufficiency
The step-1 command set SHALL be sufficient for routine remote debugging without direct backend API calls.

#### Scenario: User inspects remote state
- **WHEN** a user needs to inspect what exists remotely or read one specific remote document
- **THEN** `reffy remote ls` and `reffy remote cat <path>` provide enough visibility to inspect the linked workspace state
- **AND** the commands fail with clear messages for invalid paths or missing documents
