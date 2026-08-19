# The Paseo-Backed Remote Workspace: What It Is

## Why this artifact
The Reffy README mentions that users can push their `.reffy/` directory to a Paseo-backed remote workspace. That one line can be misleading: it reads like a built-in feature of Reffy itself, when the backend is actually a separate, privately operated application. This note is the plain-language explainer for users who are curious about the feature and want to understand what they are (and are not) getting.

## The short version
Reffy is local-first. Everything Reffy does — artifacts, specs, plans, skills — lives in the `.reffy/` directory inside your project and works with no network connection and no account.

The remote workspace is an **optional remote** for that directory. When connected, Reffy can push your local `.reffy/` tree to a hosted service, where it becomes a path-addressable remote representation of your workspace: you can inspect it, snapshot it, and reference it from other projects.

That hosted service is **Paseo** — a separate application, maintained privately, that is not part of the Reffy repository.

## What "separate private application" means in practice
- **It does not ship with Reffy.** Installing Reffy gives you the CLI and the local workspace model. It does not give you a remote backend.
- **There is no public sign-up.** Paseo is not currently a self-serve product. Using the remote workspace feature requires access to a Paseo deployment — in practice, an endpoint URL that the Reffy CLI is configured to talk to.
- **The code is not in the Reffy repo.** Paseo has its own codebase, its own release cadence, and its own operational decisions. The Reffy README describes the integration surface, not the service itself.
- **Reffy defines the contract; Paseo implements it.** The CLI speaks a documented workspace-projection protocol (push, inspect, per-document reads and writes). Paseo is the current — and so far only — implementation of that backend contract.

## What the remote workspace gives you
When your workspace is connected to a Paseo backend, you get:

- **Remote persistence** — your full `.reffy/` tree stored outside your machine.
- **Remote inspection** — documents addressable by path, plus workspace metadata and snapshots.
- **Bulk import** — push the whole local workspace up in one operation.
- **Cross-project context** — other projects (and agents) can read your workspace's projection without cloning your repo.

## What it does not change
- **Local stays the source of truth.** The remote is a deployed representation of your workspace, not a replacement for it. If the remote disappeared tomorrow, your `.reffy/` directory would be unaffected.
- **No lock-in.** Nothing in your local workspace depends on the remote existing. Connection metadata lives in your workspace manifest and can be removed.
- **No hidden syncing.** Pushes are explicit CLI operations. Reffy does not phone home in the background.

## Who should be interested
- Users who want their Reffy context available across machines or projects.
- Teams or agent setups that want a shared, inspectable projection of a workspace.
- Anyone building on the workspace-projection contract who wants a working reference backend.

If that's you, the practical next step is reaching out to the maintainer for endpoint access, since Paseo is not self-serve today. For everyone else: Reffy works fully, locally, without it.
