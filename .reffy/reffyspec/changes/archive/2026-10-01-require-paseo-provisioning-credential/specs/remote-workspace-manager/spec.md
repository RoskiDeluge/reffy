## ADDED Requirements
### Requirement: Provisioning Credential For Manager Creation
The CLI SHALL authenticate manager actor creation with the deployment provisioning credential `PASEO_PROVISIONING_TOKEN`, require it only when a manager actor will be created, confine it to the actor-creation request, and never persist it.

#### Scenario: Provisioning sends the credential on actor creation
- **WHEN** a user runs `reffy remote init --provision`
- **AND** no manager actor id is supplied through `--manager-actor`, `PASEO_MANAGER_ACTOR`, or the linkage file
- **AND** `PASEO_PROVISIONING_TOKEN` is present in environment configuration
- **THEN** the CLI calls `POST /pods/{pod}/actors` with an `Authorization: Bearer ${PASEO_PROVISIONING_TOKEN}` header
- **AND** the CLI calls `POST /pods`, when a pod must be created, without an `Authorization` header

#### Scenario: Provisioning credential is missing
- **WHEN** a user runs `reffy remote init --provision` that would create a manager actor
- **AND** `PASEO_PROVISIONING_TOKEN` is absent or blank in environment configuration
- **THEN** the command fails before issuing any network request
- **AND** the output explains that creating a Paseo manager actor requires `PASEO_PROVISIONING_TOKEN`, that the Paseo operator holds it, that it can be added to `.env` or exported, and that the CLI never persists it

#### Scenario: Joining an existing manager does not require the provisioning credential
- **WHEN** a user runs `reffy remote init` with a manager actor id supplied through `--manager-actor`, `PASEO_MANAGER_ACTOR`, or the linkage file
- **THEN** the CLI does not require `PASEO_PROVISIONING_TOKEN`
- **AND** the CLI does not send `PASEO_PROVISIONING_TOKEN` on any request even when it is present in environment configuration

#### Scenario: Provisioning credential is confined and never persisted
- **WHEN** the CLI resolves `PASEO_PROVISIONING_TOKEN`
- **THEN** it reads the value from environment configuration (shell, auto-loaded `.env`, or `--env-file`, with exported shell variables taking precedence) and trims it
- **AND** it sends the value only on `POST /pods/{pod}/actors`
- **AND** it never logs the value or writes it to `.reffy/state/remote.json` or anywhere else on disk

#### Scenario: Credentials never substitute for each other
- **WHEN** either `PASEO_TOKEN` or `PASEO_PROVISIONING_TOKEN` is missing
- **THEN** the CLI does not fall back to the other variable for the missing credential's purpose

## MODIFIED Requirements
### Requirement: Bearer Token Aware Manager Errors
The CLI SHALL surface authorization failures from the manager actor with a single shared message that names `PASEO_TOKEN` as the likely cause, and SHALL surface manager actor creation failures with provisioning-specific messages that name `PASEO_PROVISIONING_TOKEN` instead.

#### Scenario: Manager rejects authorization
- **WHEN** any manager route returns `401 Unauthorized` to a CLI request
- **AND** the request was not a manager actor creation request (`POST /pods/{pod}/actors`)
- **THEN** the command fails clearly
- **AND** the output identifies authorization as the failure mode
- **AND** the output names `PASEO_TOKEN` as the likely cause and advises confirming the value against the team secret store

#### Scenario: Paseo rejects the provisioning credential
- **WHEN** `POST /pods/{pod}/actors` returns `401 Unauthorized`
- **THEN** the command fails clearly
- **AND** the output states that Paseo rejected the provisioning credential and advises checking that `PASEO_PROVISIONING_TOKEN` matches the deployment's provisioning secret
- **AND** the output does not name `PASEO_TOKEN` as the cause

#### Scenario: Deployment has no provisioning credential configured
- **WHEN** `POST /pods/{pod}/actors` returns `503` with a JSON body whose `error.code` is `provisioning_not_configured`
- **THEN** the command fails clearly
- **AND** the output states that the Paseo deployment has no provisioning credential configured and that the operator must set `PASEO_PROVISIONING_TOKEN` as a Worker secret before managers can be created
- **AND** a `503` body that is not valid JSON does not cause a secondary parsing error
