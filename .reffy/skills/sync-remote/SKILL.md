---
name: sync-remote
description: Link, inspect, and publish a Reffy remote workspace backed by Paseo. Use for remote sync, remote status, remote workspace inspection, shared references, or requests to push a workspace, publish references, or synchronize shared context.
compatibility: Requires the Reffy CLI and an initialized Reffy workspace.
metadata:
  reffy-managed: "true"
  reffy-commands: '["reffy remote init","reffy remote status","reffy remote push","reffy remote snapshot"]'
  reffy-triggers: '["remote sync","remote workspace","push workspace","publish workspace","paseo","remote status","shared references","publish references"]'
---

## When to use this skill
Use this to link, publish, or inspect the shared remote workspace projection.

## Required environment
- `PASEO_ENDPOINT` — the Paseo endpoint URL (never persisted).
- `PASEO_TOKEN` — the bearer token (never persisted by the CLI).
- `PASEO_PROVISIONING_TOKEN` — the deployment provisioning credential, needed
  only for `reffy remote init --provision` when it creates a manager actor. Held
  by the Paseo operator; never persisted by the CLI and never a substitute for
  `PASEO_TOKEN`.
- `PASEO_APPLICATION_OWNER` — optional owner recorded in the application
  descriptor sent by `init --provision` (`--owner` wins; falls back to
  `git config user.email`).

Provide them either by exporting them in your shell or by placing them in a
`.env` file at the repo root — every `reffy remote` command auto-loads `.env`
(use `--env-file PATH` to point at a different file). Exported shell vars take
precedence over `.env`.

## Steps
1. Ensure both values are available via the shell or `.env`; the CLI fails fast and names a missing one.
2. First time: `reffy remote init --provision` to create the workspace and mint a token. Save the token immediately.
3. `reffy remote status` to confirm linkage and identity.
4. `reffy remote push` to import the full local `.reffy/` tree.
5. `reffy remote snapshot` / `ls` / `cat` to inspect the remote projection.
6. `reffy remote application get` / `set [--name] [--description] [--owner]` to inspect or describe the manager's Paseo application.

## Failure modes
- A missing token makes the stored identifiers in `.reffy/state/remote.json` inert — set `PASEO_TOKEN`.
