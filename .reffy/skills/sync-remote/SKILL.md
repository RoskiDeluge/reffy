---
name: sync-remote
description: Publish and inspect the local .reffy/ workspace on a Paseo-backed remote.
triggers: ["remote sync", "push workspace", "paseo", "remote status"]
commands: ["reffy remote init", "reffy remote status", "reffy remote push", "reffy remote snapshot"]
managed: true
---

## When to use this skill
Use this to link, publish, or inspect the shared remote workspace projection.

## Required environment
- `PASEO_ENDPOINT` — the Paseo endpoint URL (never persisted).
- `PASEO_TOKEN` — the bearer token (never persisted by the CLI).

## Steps
1. Ensure both env vars are set; the CLI fails fast and names a missing one.
2. First time: `reffy remote init --provision` to create the workspace and mint a token. Save the token immediately.
3. `reffy remote status` to confirm linkage and identity.
4. `reffy remote push` to import the full local `.reffy/` tree.
5. `reffy remote snapshot` / `ls` / `cat` to inspect the remote projection.

## Failure modes
- A missing token makes the stored identifiers in `.reffy/state/remote.json` inert — set `PASEO_TOKEN`.
