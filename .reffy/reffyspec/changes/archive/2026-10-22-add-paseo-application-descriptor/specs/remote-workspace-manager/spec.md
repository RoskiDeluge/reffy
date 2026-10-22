## ADDED Requirements

### Requirement: Application Descriptor On Manager Creation
The CLI SHALL send an application descriptor nested inside `config` whenever `reffy remote init --provision` creates a manager actor, so the resulting Paseo application registers with a name, description, and, when resolvable, an owner.

#### Scenario: Provisioning sends a descriptor with default values
- **WHEN** a user runs `reffy remote init --provision` for workspace id `<ws>` and a manager actor is created
- **THEN** the `POST /pods/{pod}/actors` body includes `config.application` with `name` set to `<ws>` and `description` set to `Reffy workspace backend for <ws>`
- **AND** the body does not include an `application` block beside `config`
- **AND** the descriptor does not include an `id` or any field other than `name`, `description`, and `owner`

#### Scenario: Label and explicit flags override descriptor defaults
- **WHEN** `--label TEXT` is supplied and `--description` is not
- **THEN** the descriptor `description` is `TEXT`
- **AND** an explicit `--name` or `--description` takes precedence over the defaults

#### Scenario: Owner resolution order
- **WHEN** the CLI builds a descriptor for manager creation
- **THEN** it sets `owner` from `--owner` when supplied
- **AND** otherwise from `PASEO_APPLICATION_OWNER` in environment configuration
- **AND** otherwise from the repository's `git config user.email`
- **AND** omits `owner` when none of these yields a non-empty value

#### Scenario: Invalid descriptor values fail before any request
- **WHEN** a resolved descriptor has a `name` outside 1–200 characters, a `description` over 2000 characters, or an `owner` outside 1–256 characters
- **THEN** the command fails before issuing any network request and names the offending field

#### Scenario: Init reports and records the application
- **WHEN** manager creation succeeds and the response includes an `application` object
- **THEN** `remote init` output includes the descriptor that was sent and the stored application, in text and JSON modes
- **AND** the CLI persists the returned `application.id` as `application_id` in `.reffy/state/remote.json`

#### Scenario: Joining an existing manager sends no descriptor
- **WHEN** `reffy remote init` runs with a manager actor id supplied through `--manager-actor`, `PASEO_MANAGER_ACTOR`, or the linkage file
- **THEN** the CLI creates no manager actor and sends no application descriptor
- **AND** the CLI keeps a previously persisted `application_id` only when the manager identity is unchanged

### Requirement: Application Descriptor Inspection And Update
The CLI SHALL provide `reffy remote application get` and `reffy remote application set` to read and update the configured manager's application descriptor with the manager token.

#### Scenario: Application get reads the descriptor
- **WHEN** a user runs `reffy remote application get` against a configured manager
- **THEN** the CLI calls `GET /pods/{pod}/actors/{manager_actor_id}/application` with `Authorization: Bearer ${PASEO_TOKEN}`
- **AND** the output reports the application's `id`, `name`, `description`, and `owner`
- **AND** the CLI records the returned `id` as `application_id` in the linkage file

#### Scenario: Application set merges supplied fields
- **WHEN** a user runs `reffy remote application set` with one or more of `--name`, `--description`, `--owner`
- **THEN** the CLI calls `PUT /pods/{pod}/actors/{manager_actor_id}/application` with only the supplied fields and `Authorization: Bearer ${PASEO_TOKEN}`
- **AND** the output reports the updated descriptor

#### Scenario: Application set without fields
- **WHEN** a user runs `reffy remote application set` without `--name`, `--description`, or `--owner`
- **THEN** the command fails before issuing any network request and lists the accepted flags
