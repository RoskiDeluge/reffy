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
Identity-aware remote workflows SHALL read local source identity and workspace membership from `.reffy/manifest.json`.

#### Scenario: Identity-aware remote command runs with valid manifest identity
- **WHEN** a user runs an identity-aware remote command
- **AND** the manifest includes `project_id` and `workspace_ids`
- **THEN** the CLI uses `project_id` as the local source identity
- **AND** the CLI resolves the selected workspace projection from `workspace_ids`
- **AND** the CLI does not require duplicate identity values from environment-only configuration

#### Scenario: Identity-aware remote command runs without manifest identity
- **WHEN** a user runs `reffy remote init`, `reffy remote status`, or `reffy remote push`
- **AND** `.reffy/manifest.json` lacks `project_id` or any workspace membership value
- **THEN** the command fails with an actionable error
- **AND** the error explains that remote sync requires manifest-backed source identity and workspace membership

#### Scenario: Remote command has ambiguous workspace membership
- **WHEN** a user runs a remote command that requires one workspace projection
- **AND** `.reffy/manifest.json` contains multiple `workspace_ids`
- **AND** the command does not specify which workspace id to use
- **THEN** the command fails clearly
- **AND** the output lists the available workspace ids and explains how to select the target projection
### Requirement: Separate Remote Linkage State
The system SHALL store remote connection metadata separately from `.reffy/manifest.json` and support multiple linkage targets for one source tree.

#### Scenario: Remote linkage is initialized
- **WHEN** a user runs `reffy remote init` with valid linkage inputs for a selected workspace id
- **THEN** Reffy writes or updates a remote linkage file under `.reffy/`
- **AND** the linkage file stores Paseo connection details such as `endpoint`, `pod_name`, and `actor_id`
- **AND** the linkage is associated with the selected workspace id
- **AND** `.reffy/manifest.json` remains the source of project identity and workspace membership rather than deployment linkage

#### Scenario: Multiple remote linkages exist
- **WHEN** one `.reffy/` source tree has linkage for multiple workspace ids
- **THEN** Reffy preserves each linkage target independently
- **AND** remote commands operate only on the selected workspace target

#### Scenario: Remote linkage is missing
- **WHEN** a user runs `reffy remote status`, `reffy remote push`, `reffy remote ls`, or `reffy remote cat <path>` for a workspace id without configured linkage
- **THEN** the command fails clearly
- **AND** the output tells the user to initialize or repair the remote linkage configuration for that workspace id
### Requirement: Paseo Provisioning Path
The first implementation SHALL keep the fresh-provision connection model minimal and explicit while provisioning against a selected workspace projection.

#### Scenario: Fresh provision uses endpoint and selected workspace
- **WHEN** a user provisions a new remote backend actor through Reffy
- **AND** `PASEO_ENDPOINT` is configured
- **AND** a workspace id has been selected or inferred
- **THEN** Reffy can create the needed pod and actor for that workspace projection without requiring separate env-provided source or workspace identity
- **AND** the resulting linkage is written to local Reffy state for later commands against that workspace id

#### Scenario: Init reports created versus reused linkage
- **WHEN** a user runs `reffy remote init`
- **THEN** the command output indicates whether the pod and actor were newly created or reused
- **AND** the output identifies the saved linkage path, source identity, and selected workspace id

#### Scenario: Existing backend target lacks workspace id support
- **WHEN** `reffy remote init`, `reffy remote status`, or `reffy remote push` encounters a linked backend actor that cannot report or validate the selected `workspace_id` (for example, a v1 actor that only exposes `workspace_name`)
- **THEN** the command fails clearly
- **AND** the output tells the user to reinitialize the remote target against the `reffyRemoteBackend.v2` contract and repush the local `.reffy/` tree
- **AND** the command does not silently treat a legacy `workspace_name` value as the canonical workspace projection id
### Requirement: Snapshot Publication Semantics
`reffy remote push` SHALL behave as an explicit "selected remote projection reflects local" operation.

#### Scenario: Push reports import and prune results
- **WHEN** a user runs `reffy remote push` with valid manifest identity and remote linkage for a selected workspace id
- **THEN** the CLI scans the full local `.reffy/` tree
- **AND** the CLI publishes the full document set to the selected Paseo workspace import target
- **AND** the payload distinguishes the local source identity from the selected workspace projection identity
- **AND** the command reports import counts such as created, updated, deleted, and imported when available
- **AND** the output makes the default replace/prune behavior auditable by a human operator

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
The system SHALL provide inspection-oriented commands that help users verify local and remote alignment for a selected workspace projection clearly enough for operational use.

#### Scenario: Remote status succeeds
- **WHEN** a user runs `reffy remote status` against a reachable linked backend for a selected workspace id
- **THEN** the output includes local source identity
- **AND** the output includes the selected workspace id
- **AND** the output includes remote workspace identity
- **AND** the output includes the saved linkage details used for the connection
- **AND** the output includes remote workspace summary metadata and document counts when available

#### Scenario: Remote endpoint is unreachable
- **WHEN** a user runs `reffy remote status`
- **AND** the configured Paseo endpoint or actor for the selected workspace id is unreachable
- **THEN** the command fails clearly
- **AND** the output identifies the linkage it attempted to use
- **AND** the output makes it clear that the failure is a reachability problem rather than a local manifest problem

#### Scenario: Remote identity mismatch is detected
- **WHEN** the linked remote workspace identity does not match the selected local workspace id or source identity expected by the local manifest
- **THEN** `reffy remote status` or `reffy remote push` fails clearly
- **AND** the output identifies the local source identity, selected workspace id, and remote identities instead of silently proceeding
### Requirement: Helper Script Integration
The first implementation SHALL include a supported helper path for validating the Paseo deployment and workspace contract.

#### Scenario: Helper script validates linkage and import
- **WHEN** a user runs the supported Paseo helper script with valid endpoint and identity context
- **THEN** the helper can provision or connect to the target pod and actor
- **AND** the helper can import the local `.reffy/` tree
- **AND** the helper can inspect the resulting workspace and manifest document remotely

#### Scenario: Helper script reads identity from the manifest
- **WHEN** a user runs the supported helper script in a repository with a valid `.reffy/manifest.json`
- **THEN** the helper reads `project_id` and `workspace_ids` from the manifest
- **AND** the helper does not require duplicate source or workspace identity values for the common case

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
### Requirement: Projection-Scoped Paseo Backend Target
Reffy remote workflows SHALL treat each linked `reffyRemoteBackend.v2` actor as storage for one source tree published into one or more selected workspace projections, with each projection addressed through `/workspaces/{workspace_id}/...` routes and isolated by `(workspace_id, path)` keying on the backend.

#### Scenario: Remote target identity is inspected
- **WHEN** Reffy inspects a linked Paseo backend actor for a selected workspace id
- **THEN** the `source` envelope returned by the actor exposes the `project_id`, `actor_type`, and backend `version`
- **AND** the `workspace` envelope returned by the actor exposes the selected `workspace_id`
- **AND** Reffy validates the source `project_id` and the selected `workspace_id` before reporting status or publishing documents

#### Scenario: One source tree has multiple workspace targets
- **WHEN** a manifest includes multiple `workspace_ids`
- **AND** the user initializes remote targets for more than one workspace id
- **THEN** Reffy stores each workspace target independently in local linkage state
- **AND** each workspace target may share a backend actor with other workspace targets for the same source `project_id`, or reference a different actor
- **AND** replacing or pruning documents in one workspace target does not affect documents in another workspace target, because the backend scopes storage and import semantics by `workspace_id`

#### Scenario: One backend actor serves multiple workspace projections
- **WHEN** a user links more than one `workspace_id` to the same backend actor
- **THEN** the Reffy remote workflow addresses each projection through the v2 `/workspaces/{workspace_id}/...` route surface
- **AND** each projection's documents and locks remain isolated on the backend by `(workspace_id, path)` keying
- **AND** `reffy remote push` for one workspace id does not mutate documents stored under a different workspace id on the same actor
