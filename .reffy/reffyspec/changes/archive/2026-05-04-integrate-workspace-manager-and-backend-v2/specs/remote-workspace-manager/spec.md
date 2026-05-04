## ADDED Requirements
### Requirement: Workspace Manager Control Plane
The CLI SHALL treat the workspace manager actor as a distinct control-plane surface, separate from the workspace backend storage actor, and SHALL persist its identity once per linkage file.

#### Scenario: Manager identity is required for control-plane operations
- **WHEN** a user runs any command that creates a workspace, resolves a workspace, registers a project, or lists project registrations
- **THEN** the CLI requires manager identity (`pod_name` and `actor_id`) to be configured in the linkage file or supplied through CLI flags
- **AND** the CLI does not derive manager identity from workspace backend identity

#### Scenario: Manager identity is shared across workspace targets
- **WHEN** a linkage file contains workspace backend identities for multiple workspace ids
- **THEN** the CLI uses a single manager identity from the linkage file for control-plane calls across those workspace targets
- **AND** the CLI does not require a separate manager identity per workspace id

#### Scenario: Manager identity is missing or incomplete
- **WHEN** a control-plane command runs without configured manager identity
- **THEN** the command fails clearly
- **AND** the output tells the user how to configure manager identity through `reffy remote init`

### Requirement: Workspace Lifecycle Through The Manager
The CLI SHALL provide explicit commands for creating and resolving a workspace through the manager actor.

#### Scenario: Workspace create provisions a backend actor
- **WHEN** a user runs `reffy remote workspace create <workspace-id>` against a configured manager
- **THEN** the CLI calls `POST /pods/{pod}/actors/{manager_actor_id}/workspaces` with the workspace id and optional metadata
- **AND** the CLI persists the returned workspace backend identity under the workspace id in the linkage file
- **AND** the output reports the created workspace id and its workspace backend identity

#### Scenario: Workspace create encounters an existing workspace
- **WHEN** the manager responds with `409 workspace already exists`
- **THEN** the CLI recovers by resolving the workspace through the manager
- **AND** the CLI persists the resolved workspace backend identity in the linkage file
- **AND** the output indicates that the workspace was reused rather than created

#### Scenario: Workspace get refreshes local backend identity
- **WHEN** a user runs `reffy remote workspace get <workspace-id>` against a configured manager
- **THEN** the CLI calls `GET /pods/{pod}/actors/{manager_actor_id}/workspaces/{workspace-id}`
- **AND** the CLI updates the persisted workspace backend identity in the linkage file when it differs from local state
- **AND** the output reports the resolved workspace id and its current workspace backend identity

#### Scenario: Workspace lookup fails for a missing workspace
- **WHEN** the manager responds with `404 workspace not found`
- **THEN** the command fails clearly
- **AND** the output tells the user to create the workspace through `reffy remote workspace create` before retrying

### Requirement: Project Registration Through The Manager
The CLI SHALL register a local `project_id` for a selected workspace through the manager before that project can import into the workspace backend.

#### Scenario: Project register is explicit
- **WHEN** a user runs `reffy remote project register` for a selected workspace id
- **THEN** the CLI calls `POST /pods/{pod}/actors/{manager_actor_id}/workspaces/{workspace-id}/projects/{project-id}` with the local `project_id`
- **AND** the CLI treats a `409 project already registered` response as a successful registration outcome
- **AND** the output reports whether the registration was newly created or already present

#### Scenario: Project register is required before import
- **WHEN** a user runs `reffy remote push` for a selected workspace id
- **AND** the local `project_id` is not yet registered for that workspace on the manager
- **THEN** the CLI registers the project through the manager before issuing the import call
- **AND** the registration step is reported as part of the push output

#### Scenario: Project list inspects registrations
- **WHEN** a user runs `reffy remote project list` for a selected workspace id
- **THEN** the CLI calls `GET /pods/{pod}/actors/{manager_actor_id}/workspaces/{workspace-id}/projects`
- **AND** the output lists registered project ids and any registration metadata returned by the manager

#### Scenario: Project register fails for a missing workspace
- **WHEN** the manager responds with `404 workspace not found` for a registration call
- **THEN** the command fails clearly
- **AND** the output tells the user to create the workspace through `reffy remote workspace create` before registering a project

### Requirement: Workspace Deletion Through The Manager
The CLI SHALL provide a destructive command for deleting a workspace through the manager actor and SHALL keep local linkage state consistent with the deletion outcome.

#### Scenario: Workspace delete tears down the workspace target
- **WHEN** a user runs `reffy remote workspace delete <workspace-id> --yes` against a configured manager
- **THEN** the CLI calls `DELETE /pods/{pod}/actors/{manager_actor_id}/workspaces/{workspace-id}`
- **AND** the CLI removes the workspace entry from `targets` in the local linkage file on a successful response
- **AND** the output reports the deleted workspace id and confirms local linkage state was cleaned up

#### Scenario: Workspace delete requires explicit confirmation
- **WHEN** a user runs `reffy remote workspace delete <workspace-id>` without `--yes`
- **THEN** the command fails clearly without making a network call
- **AND** the output explains that workspace deletion is destructive, removes shared workspace state, and requires `--yes` to proceed

#### Scenario: Workspace delete recovers when the workspace is already gone
- **WHEN** the manager responds with `404 workspace not found` to a delete request
- **THEN** the CLI treats the response as a successful deletion outcome
- **AND** the CLI removes any local linkage entry for that workspace id
- **AND** the output indicates that the workspace was already absent on the manager

### Requirement: Manager-Mediated Recovery
The CLI SHALL use the manager actor to recover lost or stale workspace backend identity in the linkage file.

#### Scenario: Workspace backend identity is missing locally
- **WHEN** a user runs `reffy remote push` or `reffy remote status` for a selected workspace id
- **AND** the linkage file does not contain workspace backend identity for that workspace id
- **THEN** the CLI resolves the workspace through the manager and refreshes the linkage file
- **AND** the CLI continues with the requested operation only after persisting the recovered identity

#### Scenario: Workspace backend identity is stale
- **WHEN** the workspace backend actor returns an identity envelope that does not match the persisted workspace backend identity for the selected workspace id
- **THEN** the CLI calls the manager to confirm the current workspace backend identity
- **AND** the CLI either refreshes the linkage file with the manager's current identity and retries, or fails with reinitialization guidance when the manager itself reports the workspace as missing
