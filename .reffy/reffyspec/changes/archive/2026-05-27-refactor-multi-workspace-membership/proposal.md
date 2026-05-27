# Change: Refactor Multi-Workspace Membership

## Why
Reffy currently treats one repository-local `.reffy/` tree as if it belongs to one canonical workspace. That fit the early manifest and remote-sync model, but it is too narrow for Nuveris-style orchestration where the same source planning tree may need to appear in a project workspace, a portfolio workspace, a dependency-planning workspace, and temporary initiative workspaces at the same time.

The current `project_id` plus `workspace_name` shape also blurs two different identities:
- the stable source identity for this `.reffy/` tree
- the workspace projections that include that source

Remote sync inherits the same confusion. A Paseo-backed push currently assumes one workspace target, but multi-workspace membership means Reffy must be able to publish a source tree into a selected workspace projection and, when needed, push newly created `.reffy/` planning directories and documents to the Paseo backend for that projection.

The Paseo-side backend already exposes multi-projection storage: the deployed `reffyRemoteBackend.v2` actor keys documents and locks by `(workspace_id, path)` and addresses each projection through `/workspaces/{workspace_id}/...` routes. Reffy should target v2 directly. One backend actor can hold many workspace projections for a given source `project_id`, and Reffy local linkage maps each `workspace_id` to its target route on the provisioned actor.

## What Changes
- Treat `project_id` as the stable source identity for a `.reffy/` tree.
- Replace canonical use of singular `workspace_name` with plural manifest membership through `workspace_ids`.
- Preserve backward compatibility by accepting older manifests with `workspace_name` and migrating that value into `workspace_ids`.
- Update identity-aware workflows so they distinguish source identity from selected workspace projection.
- Extend remote linkage state to support one or more Paseo targets keyed by workspace id.
- Require remote commands that act on a workspace projection to select a workspace id when membership is ambiguous.
- Align Reffy remote provisioning with the `reffyRemoteBackend.v2` contract: one source `project_id` provisions one backend actor, which serves one or more selected `workspace_ids` through `/workspaces/{workspace_id}/...` routes.
- Do not require compatibility with already-provisioned v1 backend actors that only understand singular `workspace_name`; those instances can be reinitialized against v2 and repushed after the refactor.
- Update remote push semantics so the full local `.reffy/` tree, including new planning directories introduced by this refactor, can be published to the selected Paseo workspace projection.

## Impact
- Affected specs:
  - `manifest-identity`
  - `remote-sync-snapshot-publication`
- Affected code:
  - `src/types.ts`
  - `src/manifest.ts`
  - `src/storage.ts`
  - `src/remote.ts`
  - `src/cli.ts`
  - remote helper scripts
  - Paseo backend actor contract and provisioning assumptions
  - manifest, migration, and remote tests
  - `README.md`

## Reffy References
- `multi-workspace-membership.md` - identifies the source identity versus workspace membership split and the need to revisit Paseo-backed remote push for multiple workspace projections.
- `paseo-multi-workspace-refactor.md` - identifies the identity and linkage split, flags that old backend actors can be reinitialized rather than preserving `workspace_name` compatibility, and outlines the v2 storage shape that is now deployed.
- `paseo-contract-reference-for-reffy.md` - documents the deployed `reffyRemoteBackend.v2` contract Reffy now targets: the `/workspaces/{workspace_id}/...` route surface, `(workspace_id, path)` storage and lock keys, and the `source` plus `workspace` identity envelopes used in every response.
