## MODIFIED Requirements
### Requirement: Separate Remote Linkage State
The system SHALL store remote connection metadata separately from `.reffy/manifest.json` and SHALL persist manager identity once per linkage file alongside per-workspace workspace backend identity.

#### Scenario: Remote linkage is initialized
- **WHEN** a user runs `reffy remote init` with valid linkage inputs for a selected workspace id
- **THEN** Reffy writes or updates a remote linkage file under `.reffy/`
- **AND** the linkage file stores the Paseo `endpoint`
- **AND** the linkage file stores manager identity as `pod_name` and `actor_id` once for the linkage file
- **AND** the linkage file stores workspace backend identity as `pod_name` and `actor_id` under the selected workspace id
- **AND** `.reffy/manifest.json` remains the source of project identity and workspace membership rather than deployment linkage

#### Scenario: Multiple remote linkages exist
- **WHEN** one `.reffy/` source tree has linkage for multiple workspace ids
- **THEN** Reffy preserves each workspace backend identity independently under its workspace id
- **AND** Reffy preserves a single manager identity shared across the workspace targets in that linkage file
- **AND** remote commands operate only on the selected workspace target

#### Scenario: Remote linkage is missing
- **WHEN** a user runs `reffy remote status`, `reffy remote push`, `reffy remote ls`, `reffy remote cat <path>`, or `reffy remote snapshot` for a workspace id without configured workspace backend identity
- **THEN** the command fails clearly
- **AND** the output tells the user to initialize or repair the remote linkage configuration for that workspace id through the manager

#### Scenario: Legacy linkage shape is detected
- **WHEN** Reffy loads a remote linkage file that uses the previous combined-backend shape and does not record manager identity or workspace backend identity
- **THEN** Reffy refuses to operate on the linkage
- **AND** the output tells the user to reinitialize against the workspace manager actor and repush the local `.reffy/` tree
- **AND** Reffy does not silently migrate the legacy shape into the new shape

### Requirement: Paseo Provisioning Path
The implementation SHALL provision and resolve workspace targets through the workspace manager actor, not through a combined backend actor.

#### Scenario: Fresh provision uses the manager actor
- **WHEN** a user provisions a new workspace target through Reffy
- **AND** the linkage file has manager identity configured or `--provision` is set
- **THEN** Reffy uses the manager actor to create the workspace and obtain its workspace backend identity
- **AND** Reffy persists the returned workspace backend identity under the selected workspace id in the linkage file
- **AND** Reffy registers the local `project_id` for that workspace through the manager actor before completing init

#### Scenario: Existing workspace is resolved through the manager
- **WHEN** a user runs `reffy remote init` for a workspace that already exists on the manager
- **THEN** Reffy resolves the workspace through the manager actor
- **AND** Reffy refreshes the local workspace backend identity from the manager response
- **AND** Reffy treats `409 workspace already exists` as a recoverable signal that resolution should be used instead of creation

#### Scenario: Init reports created versus reused linkage
- **WHEN** a user runs `reffy remote init`
- **THEN** the command output indicates whether the workspace was newly created or resolved
- **AND** the output indicates whether the local project registration was newly created or already present
- **AND** the output identifies the saved linkage path, manager identity, workspace backend identity, source identity, and selected workspace id

#### Scenario: Existing backend target lacks workspace identity envelope
- **WHEN** `reffy remote init`, `reffy remote status`, or `reffy remote push` encounters a linked workspace backend actor that cannot report or validate the selected `workspace_id` under the v2 contract
- **THEN** the command fails clearly
- **AND** the output tells the user to reinitialize the remote target against the workspace manager actor and the `reffyRemoteBackend.v2` contract and repush the local `.reffy/` tree
- **AND** the command does not silently treat a legacy identity value as the canonical workspace projection id

### Requirement: Snapshot Publication Semantics
`reffy remote push` SHALL behave as an explicit "selected remote projection reflects local" operation against the workspace backend actor's per-project import route, with project registration as a precondition.

#### Scenario: Push registers the project before importing
- **WHEN** a user runs `reffy remote push` for a selected workspace id
- **AND** the local `project_id` is not yet registered for that workspace on the manager
- **THEN** the CLI registers the local `project_id` for that workspace through the manager actor before importing
- **AND** the CLI treats a `409 project already registered` response as a successful registration outcome
- **AND** the CLI reports whether the registration was newly created or already present

#### Scenario: Push imports through the per-project route
- **WHEN** a user runs `reffy remote push` with valid manifest identity and remote linkage for a selected workspace id
- **THEN** the CLI scans the full local `.reffy/` tree
- **AND** the CLI publishes the full document set to the workspace backend actor's `POST /workspace/projects/{project_id}/import` route for the local `project_id`
- **AND** the payload uses the local `project_id` as contribution identity and the selected workspace id as actor identity rather than as a route segment on a combined backend
- **AND** the command reports import counts such as created, updated, deleted, and imported when available
- **AND** the output makes the default replace/prune behavior auditable by a human operator
- **AND** the command updates `last_imported_at` for the selected workspace target in the linkage file

#### Scenario: Push fails for an unregistered project
- **WHEN** the workspace backend returns `404 project not registered` from an import attempt
- **AND** the CLI cannot recover by re-registering through the manager
- **THEN** the command fails clearly
- **AND** the output tells the user to register the local `project_id` for that workspace before retrying

#### Scenario: Push response is incomplete
- **WHEN** a remote push response omits required source identity, workspace projection identity, or import metadata
- **THEN** the command fails
- **AND** the CLI does not report the push as a successful synchronization
- **AND** the failure message identifies the missing response detail

### Requirement: Remote Inspection and Verification
The system SHALL provide inspection-oriented commands that read from the workspace backend actor's per-project routes and SHALL include a per-project snapshot command.

#### Scenario: Remote status succeeds
- **WHEN** a user runs `reffy remote status` against a reachable linked workspace backend for a selected workspace id
- **THEN** the output includes local source identity
- **AND** the output includes the selected workspace id
- **AND** the output includes remote workspace identity from the workspace backend summary
- **AND** the output includes the saved linkage details for both the manager identity and the workspace backend identity used for the connection
- **AND** the output includes remote per-project document counts and workspace summary metadata when available

#### Scenario: Remote ls and cat operate per project
- **WHEN** a user runs `reffy remote ls` or `reffy remote cat <path>` for a selected workspace id
- **THEN** the CLI calls the workspace backend actor's per-project document routes for the local `project_id`
- **AND** the CLI accepts an explicit project id override when inspecting another project's contribution
- **AND** the commands fail clearly with an unregistered-project guidance message when the backend reports `404 project not registered`

#### Scenario: Remote snapshot is available
- **WHEN** a user runs `reffy remote snapshot` for a selected workspace id
- **THEN** the CLI calls the workspace backend actor's `GET /workspace/projects/{project_id}/snapshot` route for the local `project_id`
- **AND** the output reports the snapshot contents or summary in the requested output mode

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
