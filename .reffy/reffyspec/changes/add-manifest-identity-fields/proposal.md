# Change: Add Manifest Identity Fields

## Why
Reffy currently treats `.reffy/manifest.json` as the local source of artifact metadata, but workspace identity still lives outside the manifest contract. Adding first-class manifest identity fields gives Reffy a canonical local source for project identity, reduces duplicated config, and creates a stable place for future workspace-level metadata.

## What Changes
- Add `project_id` and `workspace_name` as optional top-level manifest v1 fields owned by Reffy.
- Preserve `created_at` and `updated_at` as required top-level manifest timestamps alongside the new identity fields.
- Define initialization defaults so newly created manifests can populate both identity fields deterministically.
- Require manifest validation to accept the new fields when present and fail clearly when identity is required for identity-aware workflows but missing.
- Define backward-compatible migration behavior for older manifests that do not yet include the identity fields.
- Allow Reffy CLI workflows that provision or update external backends to read identity from `.reffy/manifest.json` instead of separate downstream-only config.

## Impact
- Affected specs: `manifest-identity`
- Affected code: `src/types.ts`, `src/manifest.ts`, `src/storage.ts`, workspace/bootstrap flows, identity-aware CLI commands, `README.md`

## Reffy References
- `manifest-identity.md` - establishes the need for Reffy-owned `project_id` and `workspace_name` in `.reffy/manifest.json`, while preserving manifest timestamps.
