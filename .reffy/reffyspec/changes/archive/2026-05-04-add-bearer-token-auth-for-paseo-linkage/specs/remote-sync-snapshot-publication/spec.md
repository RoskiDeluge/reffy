## MODIFIED Requirements
### Requirement: Separate Remote Linkage State
The system SHALL store remote connection metadata separately from `.reffy/manifest.json` and SHALL keep the persisted linkage file free of access-granting and root-URL information.

#### Scenario: Remote linkage is initialized
- **WHEN** a user runs `reffy remote init` with valid environment configuration for a selected workspace id
- **THEN** Reffy writes or updates a remote linkage file under `.reffy/`
- **AND** the linkage file stores manager identity as `pod_name` and `actor_id` once for the linkage file
- **AND** the linkage file stores workspace backend identity as `pod_name` and `actor_id` under the selected workspace id
- **AND** the linkage file does not contain the Paseo endpoint URL
- **AND** the linkage file does not contain the bearer token used to authenticate Paseo requests
- **AND** `.reffy/manifest.json` remains the source of project identity and workspace membership rather than deployment linkage

#### Scenario: Legacy linkage shape is detected
- **WHEN** Reffy loads a remote linkage file written by a previous version that includes `endpoint` at the linkage root or that does not declare the current version
- **THEN** Reffy refuses to operate on the linkage
- **AND** the output tells the user to reinitialize against the workspace manager actor with the current bearer-token-aware flow and repush the local `.reffy/` tree
- **AND** Reffy does not silently migrate the legacy shape into the new shape

### Requirement: Paseo Provisioning Path
The implementation SHALL provision and resolve workspace targets through the workspace manager actor, with the bearer token sourced from environment configuration on every request.

#### Scenario: Fresh provision uses the manager actor and surfaces a one-time token
- **WHEN** a user provisions a new workspace target through Reffy with `--provision`
- **AND** environment configuration provides `PASEO_ENDPOINT`
- **THEN** Reffy uses the manager actor to create the workspace and obtain its workspace backend identity
- **AND** Reffy persists the returned workspace backend identity under the selected workspace id in the linkage file
- **AND** Reffy registers the local `project_id` for that workspace through the manager actor before completing init
- **AND** Reffy prints the manager bearer token returned by the backend exactly once, with explicit guidance that the token will not be shown again and must be saved to a secret store
- **AND** Reffy does not persist the bearer token to any file under `.reffy/`

#### Scenario: Existing workspace is resolved through the manager
- **WHEN** a user runs `reffy remote init` for a workspace that already exists on the manager
- **AND** environment configuration provides both `PASEO_ENDPOINT` and `PASEO_TOKEN`
- **THEN** Reffy resolves the workspace through the manager actor
- **AND** Reffy refreshes the local workspace backend identity from the manager response
- **AND** Reffy treats `409 workspace already exists` as a recoverable signal that resolution should be used instead of creation

#### Scenario: Init reports created versus reused linkage
- **WHEN** a user runs `reffy remote init`
- **THEN** the command output indicates whether the workspace was newly created or resolved
- **AND** the output indicates whether the local project registration was newly created or already present
- **AND** the output identifies the saved linkage path, manager identity, workspace backend identity, source identity, and selected workspace id
- **AND** the output does not include the Paseo endpoint URL or the bearer token in the persisted linkage description

### Requirement: Snapshot Publication Semantics
`reffy remote push` SHALL behave as an explicit "selected remote projection reflects local" operation against the workspace backend actor's per-project import route, with project registration as a precondition and bearer-token authentication on every request.

#### Scenario: Push registers the project before importing
- **WHEN** a user runs `reffy remote push` for a selected workspace id
- **AND** environment configuration provides both `PASEO_ENDPOINT` and `PASEO_TOKEN`
- **AND** the local `project_id` is not yet registered for that workspace on the manager
- **THEN** the CLI registers the local `project_id` for that workspace through the manager actor before importing
- **AND** the CLI treats a `409 project already registered` response as a successful registration outcome

#### Scenario: Push imports through the per-project route
- **WHEN** a user runs `reffy remote push` with valid manifest identity, environment configuration, and remote linkage for a selected workspace id
- **THEN** the CLI scans the full local `.reffy/` tree
- **AND** every Paseo request issued by the CLI carries an `Authorization: Bearer ${PASEO_TOKEN}` header
- **AND** the CLI publishes the full document set to the workspace backend actor's `POST /workspace/projects/{project_id}/import` route for the local `project_id`
- **AND** the command updates `last_imported_at` for the selected workspace target in the linkage file

### Requirement: Remote Inspection and Verification
The system SHALL provide inspection-oriented commands that read from the workspace backend actor's per-project routes using bearer-token authentication.

#### Scenario: Remote status reports manager and backend identity without persisting endpoint or token
- **WHEN** a user runs `reffy remote status` against a reachable linked workspace backend for a selected workspace id
- **THEN** the output includes local source identity, the selected workspace id, manager identity, workspace backend identity, and remote workspace identity from the backend summary
- **AND** the output identifies the Paseo endpoint that was used for the request as runtime information sourced from environment, not as persisted linkage state
- **AND** the output does not include the bearer token

#### Scenario: Remote endpoint is unreachable
- **WHEN** a user runs `reffy remote status`
- **AND** the configured Paseo endpoint, manager actor, or workspace backend actor for the selected workspace id is unreachable
- **THEN** the command fails clearly
- **AND** the output identifies which linkage component it attempted to use
- **AND** the output makes it clear that the failure is a reachability problem rather than a local manifest problem

#### Scenario: Remote identity mismatch is detected
- **WHEN** the linked remote workspace identity does not match the selected local workspace id or source identity expected by the local manifest
- **THEN** `reffy remote status` or `reffy remote push` fails clearly
- **AND** the output identifies the local source identity, selected workspace id, and remote identities instead of silently proceeding

## ADDED Requirements
### Requirement: Bearer Token Authentication
The CLI SHALL send a bearer token on every Paseo request and SHALL source the token, along with the Paseo endpoint, from environment configuration only.

#### Scenario: Authorization header is sent on every Paseo request
- **WHEN** the CLI issues any HTTP request to the Paseo manager actor or to a workspace backend actor
- **THEN** the request includes an `Authorization: Bearer ${PASEO_TOKEN}` header
- **AND** the header value is sourced from the `PASEO_TOKEN` environment variable resolved at request time
- **AND** the CLI does not read the token from the local linkage file or any other persisted Reffy state

#### Scenario: Required environment configuration is missing
- **WHEN** a user runs any non-help `reffy remote` command
- **AND** `PASEO_ENDPOINT` or `PASEO_TOKEN` is not present in the resolved environment configuration
- **THEN** the command fails before issuing any network request
- **AND** the output names the missing variable and points the user at `.env` or the equivalent shell configuration

#### Scenario: Authorization is rejected by Paseo
- **WHEN** any Paseo route returns `401 Unauthorized` to a CLI request
- **THEN** the command fails clearly
- **AND** the output identifies authorization as the failure mode and names `PASEO_TOKEN` as the likely cause
- **AND** the output advises the user to confirm the token in their team secret store and re-export the variable

#### Scenario: Endpoint is sourced from environment rather than persisted state
- **WHEN** the CLI selects an endpoint to call for any remote command
- **THEN** the endpoint is taken from `PASEO_ENDPOINT` environment configuration
- **AND** the CLI does not read the endpoint from the persisted linkage file
- **AND** the CLI does not write the endpoint to the persisted linkage file
