# Manifest Identity

`project_id` and `workspace_name` should live in Reffy itself rather than only in downstream Paseo actor config.

## Why

- Gives Reffy a canonical local source of workspace identity
- Reduces duplication between local Reffy config and deployed actor metadata
- Makes local-to-remote sync behavior cleaner and easier to reason about
- Creates a natural place for future cross-project dependency metadata

## Proposed Location

Store both fields in `.reffy/manifest.json`, with Reffy owning:

- creation defaults
- validation
- migration for older manifests
- CLI reads for commands that provision or update remote backends

## Suggested Shape

```json
{
  "version": 1,
  "project_id": "paseo-core-reffy",
  "workspace_name": "paseo-core-reffy",
  "artifacts": []
}
```
<!-- looks good. but please make sure to retain the created_at and updated_at fields too.  -->

## Remote Sync Expectations
<!-- No need to worry about this. The remote sync is handled by a different project. -->
- Read `project_id` and `workspace_name` from the manifest
- Use those fields when provisioning or updating the remote backend
- Fail clearly when identity is required but missing
