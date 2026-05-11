# Remote Workspace Collaboration Steps

How collaborators (humans or agents) share a Paseo-backed Reffy workspace across multiple source repos.

## Required `.env` values

Each collaborator's source repo needs these four values in its `.env` (or exported in the shell):

| Variable | Purpose |
| --- | --- |
| `PASEO_ENDPOINT` | Paseo base URL hosting the workspace. |
| `PASEO_TOKEN` | Bearer token minted by `reffy remote init --provision`. Never persisted to disk by the CLI — must live in `.env` or the shell. |
| `PASEO_MANAGER_POD` | Paseo pod hosting the `reffyWorkspaceManager.v1` actor. |
| `PASEO_MANAGER_ACTOR` | Actor id of that workspace manager. |

CLI flag overrides exist for the first three: `--endpoint`, `--manager-pod`, `--manager-actor`. The token can only come from the environment.

## Provisioning flow (one-time, by workspace owner)

1. Owner runs `reffy remote init --provision` in their repo.
2. That call mints the `reffyWorkspaceManager.v1` actor and issues the bearer token.
3. Owner copies the four values (`PASEO_ENDPOINT`, `PASEO_TOKEN`, `PASEO_MANAGER_POD`, `PASEO_MANAGER_ACTOR`) into the team secret store and shares them out-of-band with collaborators.

## Attach flow (each collaborator, per source repo)

1. Drop the four env values into the repo's `.env`.
2. Run `reffy remote init` (no `--provision`) to attach the local `.reffy/` tree to the existing workspace.
3. The manager records the projection as `(workspace_id, path)`, so multiple `.reffy/` trees can publish into the same `workspace_id` (e.g. `nuveris-v1`).
4. From then on, `reffy remote push` and `reffy remote pull` operate against the shared workspace.

## Portfolio / multi-workspace notes

- Manifests carry plural `workspace_ids`, so a single `.reffy/` tree can live in both its own project workspace and one or more portfolio workspaces (e.g. `nuveris-v1`).
- When membership is plural, pass `--workspace-id` to remote commands to disambiguate which projection to act on.
- Per-project `.reffy/state/remote.json` holds one entry per workspace the tree belongs to.

## Failure modes to recognize

- Missing `PASEO_TOKEN` → remote commands abort with a message pointing back to `.env`.
- Legacy v3 `remote.json` (pre bearer-token auth) → CLI refuses to use it and instructs you to re-run `reffy remote init` after setting `PASEO_ENDPOINT` and `PASEO_TOKEN`.
- Missing `PASEO_MANAGER_POD` / `PASEO_MANAGER_ACTOR` on a non-provision `remote init` → cannot locate the manager actor; attach fails.
