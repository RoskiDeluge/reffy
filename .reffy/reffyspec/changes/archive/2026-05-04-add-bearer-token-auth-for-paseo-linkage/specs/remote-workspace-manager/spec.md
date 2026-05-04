## MODIFIED Requirements
### Requirement: Workspace Manager Control Plane
The CLI SHALL treat the workspace manager actor as a distinct control-plane surface, persist its identity once per linkage file, and authenticate every manager request with the configured bearer token.

#### Scenario: Manager identity is required for control-plane operations
- **WHEN** a user runs any command that creates a workspace, resolves a workspace, registers a project, lists project registrations, deletes a workspace, or rotates the manager token
- **THEN** the CLI requires manager identity (`pod_name` and `actor_id`) to be configured in the linkage file or supplied through CLI flags
- **AND** the CLI requires `PASEO_ENDPOINT` and `PASEO_TOKEN` to be present in environment configuration
- **AND** every manager request carries an `Authorization: Bearer ${PASEO_TOKEN}` header

#### Scenario: Manager identity is shared across workspace targets
- **WHEN** a linkage file contains workspace backend identities for multiple workspace ids
- **THEN** the CLI uses a single manager identity from the linkage file for control-plane calls across those workspace targets
- **AND** the CLI authenticates those calls with the same `PASEO_TOKEN` value
- **AND** the CLI does not require a separate manager identity or separate token per workspace id

#### Scenario: Manager identity or required environment is missing
- **WHEN** a control-plane command runs without configured manager identity
- **OR** without `PASEO_ENDPOINT` or `PASEO_TOKEN` in environment configuration
- **THEN** the command fails clearly before issuing any network request
- **AND** the output explains how to configure manager identity through `reffy remote init` and how to supply the missing environment variables

## ADDED Requirements
### Requirement: One-Time Manager Token Issuance
The CLI SHALL surface the manager bearer token returned during fresh provisioning exactly once and SHALL never persist it to disk.

#### Scenario: Provisioning prints the token once in text mode
- **WHEN** a user runs `reffy remote init --provision`
- **AND** the manager backend mints and returns a bearer token
- **THEN** the CLI prints the token in a clearly delimited block in text mode
- **AND** the surrounding output explicitly states that the token will not be shown again and must be saved to a secret store
- **AND** the CLI does not write the token to any file under `.reffy/` or anywhere else on disk

#### Scenario: Provisioning surfaces the token once in JSON mode
- **WHEN** a user runs `reffy remote init --provision --output json`
- **AND** the manager backend mints and returns a bearer token
- **THEN** the JSON payload includes the token under a `manager_token` field
- **AND** the JSON payload includes a flag or note indicating that the token is one-time output and was not persisted

#### Scenario: Joining an existing manager requires the operator-supplied token
- **WHEN** a user runs `reffy remote init` against an existing manager without `--provision`
- **AND** the operator has set `PASEO_TOKEN` in environment configuration
- **THEN** the CLI uses the supplied token for every manager and workspace backend request
- **AND** the CLI does not call any backend route that retrieves an existing token

### Requirement: Manager Token Rotation
The CLI SHALL provide a `reffy remote token rotate` subcommand that requests a fresh bearer token from the manager and surfaces it once for the operator to capture.

#### Scenario: Token rotate replaces the active token
- **WHEN** a user runs `reffy remote token rotate`
- **AND** environment configuration provides the current valid `PASEO_TOKEN`
- **THEN** the CLI calls the manager rotation route with the current token
- **AND** the CLI prints the new token once with the same one-time guidance used during provisioning
- **AND** the CLI does not persist the new token to disk
- **AND** subsequent CLI requests fail until the operator updates `PASEO_TOKEN` in environment configuration

#### Scenario: Token rotate requires confirmation
- **WHEN** a user runs `reffy remote token rotate` without `--yes`
- **THEN** the command fails clearly without making a network call
- **AND** the output explains that rotation invalidates the currently shared token across every consumer of this manager and requires `--yes` to proceed

#### Scenario: Backend rotation route is not available
- **WHEN** the manager backend does not yet expose a token rotation route
- **THEN** the CLI fails with a clear message that the rotation route is not deployed on the linked manager
- **AND** the output advises the operator to coordinate a Paseo backend update before retrying

### Requirement: Bearer Token Aware Manager Errors
The CLI SHALL surface authorization failures from the manager actor with a single shared message that names `PASEO_TOKEN` as the likely cause.

#### Scenario: Manager rejects authorization
- **WHEN** any manager route returns `401 Unauthorized` to a CLI request
- **THEN** the command fails clearly
- **AND** the output identifies authorization as the failure mode
- **AND** the output names `PASEO_TOKEN` as the likely cause and advises confirming the value against the team secret store
