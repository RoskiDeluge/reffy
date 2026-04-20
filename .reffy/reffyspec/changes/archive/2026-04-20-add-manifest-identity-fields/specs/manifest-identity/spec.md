## ADDED Requirements

### Requirement: Manifest-Owned Workspace Identity
The manifest contract SHALL support Reffy-owned workspace identity through top-level `project_id` and `workspace_name` fields in `.reffy/manifest.json`.

#### Scenario: Identity fields are present in the manifest
- **WHEN** a manifest includes `project_id` and `workspace_name`
- **THEN** Reffy treats those fields as the canonical local workspace identity
- **AND** identity-aware workflows read them from the manifest instead of requiring downstream-only config

### Requirement: Manifest Initialization Preserves Core Timestamps
Reffy MUST preserve the existing top-level `created_at` and `updated_at` manifest fields when adding workspace identity support.

#### Scenario: New manifest is initialized
- **WHEN** Reffy creates a new `.reffy/manifest.json`
- **THEN** the manifest includes `version`, `created_at`, `updated_at`, `project_id`, `workspace_name`, and `artifacts`
- **AND** the timestamp fields remain valid ISO timestamps

### Requirement: Deterministic Identity Defaults
Reffy SHALL create deterministic default values for `project_id` and `workspace_name` during workspace initialization.

#### Scenario: Workspace is initialized without explicit identity overrides
- **WHEN** a user runs the initialization flow for a repository that does not yet have a manifest
- **THEN** Reffy derives default values for `project_id` and `workspace_name`
- **AND** the generated values are written to the new manifest

### Requirement: Backward-Compatible Manifest Validation
Manifest validation MUST remain backward compatible for existing v1 manifests while enforcing the shape of identity fields when they are present.

#### Scenario: Existing manifest omits identity fields
- **WHEN** validation runs against a v1 manifest that does not include `project_id` or `workspace_name`
- **THEN** validation does not fail solely because those fields are absent
- **AND** the manifest remains eligible for migration or upgrade flows

#### Scenario: Manifest includes invalid identity values
- **WHEN** validation runs against a manifest where `project_id` or `workspace_name` is present but empty or malformed
- **THEN** validation exits non-zero
- **AND** the reported errors identify which identity field is invalid

### Requirement: Identity-Aware Workflow Failure Behavior
Reffy MUST fail clearly when a workflow requires workspace identity and the manifest does not provide it.

#### Scenario: Identity-required command runs without manifest identity
- **WHEN** a CLI workflow that depends on workspace identity runs against a manifest that lacks required identity values
- **THEN** the command exits non-zero
- **AND** stderr explains which identity field is missing and how to provide or migrate it

### Requirement: Manifest Identity Migration
Reffy SHALL provide a migration path for existing manifests that predate manifest-owned identity fields.

#### Scenario: Older manifest is upgraded
- **WHEN** Reffy encounters an existing v1 manifest without `project_id` or `workspace_name`
- **THEN** Reffy can populate the missing identity fields through an explicit migration or rewrite flow
- **AND** existing artifact metadata and manifest timestamps are preserved unless a normal update requires `updated_at` to change
