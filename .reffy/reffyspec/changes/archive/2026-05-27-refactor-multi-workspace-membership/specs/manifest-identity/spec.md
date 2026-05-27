## MODIFIED Requirements
### Requirement: Manifest-Owned Workspace Identity
The manifest contract SHALL support Reffy-owned source identity and workspace membership through top-level `project_id` and `workspace_ids` fields in `.reffy/manifest.json`.

#### Scenario: Identity fields are present in the manifest
- **WHEN** a manifest includes `project_id` and `workspace_ids`
- **THEN** Reffy treats `project_id` as the stable local source identity
- **AND** Reffy treats `workspace_ids` as the canonical set of workspace memberships for that source
- **AND** identity-aware workflows read those values from the manifest instead of requiring downstream-only config

#### Scenario: Manifest has multiple workspace memberships
- **WHEN** a manifest includes more than one value in `workspace_ids`
- **THEN** Reffy preserves every membership during validation, indexing, and manifest rewrites
- **AND** Reffy does not collapse the memberships into a single canonical workspace name

### Requirement: Manifest Initialization Preserves Core Timestamps
Reffy MUST preserve the existing top-level `created_at` and `updated_at` manifest fields when adding source identity and workspace membership support.

#### Scenario: New manifest is initialized
- **WHEN** Reffy creates a new `.reffy/manifest.json`
- **THEN** the manifest includes `version`, `created_at`, `updated_at`, `project_id`, `workspace_ids`, and `artifacts`
- **AND** `workspace_ids` contains at least one valid workspace id
- **AND** the timestamp fields remain valid ISO timestamps

### Requirement: Deterministic Identity Defaults
Reffy SHALL create deterministic default values for `project_id` and `workspace_ids` during workspace initialization.

#### Scenario: Workspace is initialized without explicit identity overrides
- **WHEN** a user runs the initialization flow for a repository that does not yet have a manifest
- **THEN** Reffy derives a default `project_id`
- **AND** Reffy derives at least one default workspace id for `workspace_ids`
- **AND** the generated values are written to the new manifest

### Requirement: Backward-Compatible Manifest Validation
Manifest validation MUST remain backward compatible for existing v1 manifests while enforcing the shape of identity fields when they are present.

#### Scenario: Existing manifest omits identity fields
- **WHEN** validation runs against a v1 manifest that does not include `project_id`, `workspace_ids`, or `workspace_name`
- **THEN** validation does not fail solely because those fields are absent
- **AND** the manifest remains eligible for migration or upgrade flows

#### Scenario: Existing manifest uses singular workspace name
- **WHEN** validation runs against a v1 manifest that includes `project_id` and `workspace_name` but not `workspace_ids`
- **THEN** validation treats `workspace_name` as deprecated compatibility input
- **AND** the manifest remains eligible for migration to `workspace_ids`

#### Scenario: Manifest includes invalid identity values
- **WHEN** validation runs against a manifest where `project_id` or any `workspace_ids` value is present but empty or malformed
- **THEN** validation exits non-zero
- **AND** the reported errors identify which identity field or workspace id is invalid

### Requirement: Identity-Aware Workflow Failure Behavior
Reffy MUST fail clearly when a workflow requires source identity or workspace membership and the manifest does not provide the required values.

#### Scenario: Identity-required command runs without manifest identity
- **WHEN** a CLI workflow that depends on source identity or workspace membership runs against a manifest that lacks required identity values
- **THEN** the command exits non-zero
- **AND** stderr explains which field is missing and how to provide or migrate it

#### Scenario: Workspace-targeted command is ambiguous
- **WHEN** a CLI workflow must act on one workspace projection
- **AND** the manifest contains multiple `workspace_ids`
- **AND** the user has not selected a workspace id through the command interface or configured default
- **THEN** the command exits non-zero
- **AND** stderr lists the available workspace ids and explains how to select one

### Requirement: Manifest Identity Migration
Reffy SHALL provide a migration path for existing manifests that predate plural workspace membership fields.

#### Scenario: Older manifest is upgraded
- **WHEN** Reffy encounters an existing v1 manifest without `project_id`, `workspace_ids`, or `workspace_name`
- **THEN** Reffy can populate the missing identity fields through an explicit migration or rewrite flow
- **AND** existing artifact metadata and manifest timestamps are preserved unless a normal update requires `updated_at` to change

#### Scenario: Singular workspace identity is upgraded
- **WHEN** Reffy migrates an existing v1 manifest that includes `workspace_name`
- **THEN** Reffy writes the old `workspace_name` value into `workspace_ids`
- **AND** Reffy preserves `project_id` as the source identity
- **AND** existing artifact metadata and manifest timestamps are preserved unless a normal update requires `updated_at` to change
