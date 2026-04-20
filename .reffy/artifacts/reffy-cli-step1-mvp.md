# Reffy CLI Step 1 MVP

## Why this artifact
This note isolates step 1 from the near-term MVP progression:

- keep improving deterministic Reffy CLI integration for the backend

That needs its own treatment because it is the foundation for everything that follows.

If this step is underspecified, the later steps become unstable:
- dependency metadata will have no dependable transport
- the remote backend will remain awkward to use
- and any future micro-agent layer will sit on top of unreliable workflow primitives

So the real purpose of step 1 is not "add some CLI commands."
It is to make the local `.reffy/` workspace and the remote Paseo backend behave like one coherent system under explicit, predictable rules.

## Core judgment
Step 1 should be boring.

That is a feature.

The CLI behavior should be:
- deterministic
- inspectable
- explicit about state and failure
- and free of agentic interpretation

This is not the layer where Reffy should be clever.
This is the layer where Reffy should be trustworthy.

## What step 1 is trying to achieve
At the end of step 1, a Reffy user should be able to:

1. identify a local workspace
2. link it to a remote backend
3. push the full local `.reffy/` tree to that backend
4. inspect the remote representation
5. verify that local and remote state are aligned

If those five things work consistently, the remote backend becomes real product surface instead of an implemented backend capability.

## What step 1 is not trying to achieve
Step 1 should explicitly avoid:
- semantic search
- dependency graph traversal
- pull/merge reconciliation logic
- scoped sharing
- diff-aware conflict resolution
- agent-assisted context selection

Those are later concerns.
Step 1 is just the stable substrate.

## The main product promise of step 1
The user should be able to think:

"My local `.reffy/` workspace has a remote representation, and Reffy gives me a predictable way to initialize it, push to it, inspect it, and verify it."

That is enough for a first operational MVP.

## Minimum command surface
I would keep the first version to five commands:

- `reffy remote init`
- `reffy remote status`
- `reffy remote push`
- `reffy remote ls`
- `reffy remote cat <path>`

That is the smallest surface that still makes the backend usable.

Anything less leaves too much manual work.
Anything more risks overbuilding before the workflow is proven.

## Command-by-command intent

### `reffy remote init`
Purpose:
- establish or confirm that the local workspace intends to use a remote backend

What it should do:
- read `project_id` and `workspace_name` from `.reffy/manifest.json`
- validate that they exist or help create them
- record remote backend connection details
- optionally record pod/actor identity if already provisioned

What it should not do by default:
- silently deploy infrastructure
- push the workspace immediately

This command should establish local intent and configuration, not perform side effects the user did not ask for.

### `reffy remote status`
Purpose:
- show local identity, remote linkage, and remote reachability

What it should show:
- local `project_id`
- local `workspace_name`
- configured endpoint
- configured pod id
- configured actor id
- whether the remote backend is reachable
- remote workspace identity
- remote document counts when reachable

This should be the first command a user runs when something feels off.

### `reffy remote push`
Purpose:
- make remote state reflect the current local `.reffy/` tree

What it should do:
- walk the local `.reffy/` directory
- construct the bulk import payload
- call the import endpoint
- use `replace_missing=true` by default
- print created/updated/deleted counts

This is the core value path for the MVP.

### `reffy remote ls`
Purpose:
- inspect what exists remotely without downloading everything

What it should do:
- list remote paths
- optionally support a prefix filter later

This is operationally important because users trust systems they can inspect cheaply.

### `reffy remote cat <path>`
Purpose:
- inspect one remote document directly

What it should do:
- fetch a path-addressable remote document
- print the content
- fail clearly if the path is missing

This is the most direct debugging command.

## Manifest should be the source of identity
For step 1, Reffy should treat `.reffy/manifest.json` as the source of:
- `project_id`
- `workspace_name`

That is the right choice because:
- the identity belongs to the workspace
- it should be visible in the local repo
- and it should not have to be repeated in ad hoc environment variables

Environment variables may still be useful as overrides, but they should not be the default identity source.

## Connection metadata should probably live separately
I would not put remote endpoint, pod id, and actor id into the manifest immediately unless there is a strong reason to commit that linkage into the repo.

A cleaner split is:
- manifest stores workspace identity
- a Reffy-managed local config stores remote connection details

That keeps:
- portable workspace identity
separate from:
- environment-specific deployment linkage

This is likely the more durable path.

## Default push semantics
`reffy remote push` should have one clear default:

- remote is a reflection of local

That means:
- full workspace import
- prune remote docs that no longer exist locally
- no partial interpretation by default

This is the simplest model for users to understand.

If the system later adds:
- `--no-prune`
- `--only`
- `--prefix`

those should be explicit flags, not hidden defaults.

## Verification matters as much as push
If step 1 only pushes and does not verify, users will not trust it.

A good push result should include:
- local file count
- imported count
- created count
- updated count
- deleted count
- remote workspace identity

And a good status command should expose:
- local identity
- remote identity
- remote document count

This makes the system auditable by humans.

## Failure model
The CLI should fail hard and clearly when:
- `.reffy/manifest.json` is missing
- `project_id` or `workspace_name` is missing
- remote connection is not configured
- the backend is unreachable
- remote identity does not match local identity
- import returns invalid or partial data

The CLI should not smooth over these cases.
This is infrastructure workflow.
It should be explicit.

## How provisioning should behave in step 1
There are two ways to handle actor creation:

### Option A: CLI only connects to an existing actor
Pros:
- simpler
- less infrastructure responsibility in the CLI

Cons:
- setup remains more manual

### Option B: CLI can provision the actor
Pros:
- better user experience
- less manual setup friction

Cons:
- more coupling between Reffy and Paseo deployment concerns

My recommendation for step 1 is:
- support connect-to-existing first
- optionally provide helper provisioning if it stays thin and explicit

Do not let provisioning complexity dominate the MVP.

## A good implementation sequence for step 1 itself
Within step 1, I would build in this order:

1. manifest identity validation
2. local remote-link config storage
3. `reffy remote status`
4. `reffy remote push`
5. `reffy remote ls`
6. `reffy remote cat`

This keeps the core flow moving from:
- identity
- to linkage
- to verification
- to sync
- to inspection

That is the right operational order.

## Exit criteria for step 1
I would consider step 1 done when all of the following are true:

- a workspace with `project_id` and `workspace_name` can be linked to a remote backend
- `reffy remote status` clearly reports local and remote identity
- `reffy remote push` reliably syncs the entire local `.reffy/` tree
- the user can inspect remote files with `ls` and `cat`
- failures are clear and non-magical

That is enough to support the next MVP steps without pretending the system is more mature than it is.

## Why this order is correct
This order is correct because later features depend on stability here.

Before Reffy can support:
- dependency-aware remote context
- richer metadata relationships
- or a micro-agent reasoning layer

it needs:
- a stable identity model
- a trustworthy sync model
- and a dependable remote inspection surface

Step 1 is what creates that foundation.

## Short conclusion
Step 1 should be treated as the operational backbone of the MVP.

The goal is not to make Reffy remote workflows impressive.
The goal is to make them dependable.

If Reffy can:
- identify a workspace
- link it
- push it
- inspect it
- and verify it

then the backend becomes solid enough to justify the more intelligent layers that come after.

<!-- Me: Cool. I think what's interesting is that this feature in particular bridges the two projects involved: reffy and paseo. I'm going to take these recommendations and work with them directly in the reffy project. It's also interesting because once we reach mvp, I should be able to grab relevant .reffy documents remotely from any project, so it would solve my current problem of having to manually share these files between projects -->

Yes. That is the real payoff of this direction.

If Reffy owns the local identity, sync workflow, and remote inspection ergonomics, while Paseo owns the remote actor/runtime surface, then the bridge stays clean:

Reffy becomes the user-facing context system
Paseo becomes the durable transport and backend substrate
That split is strong because it avoids forcing either project to pretend to be the other.

And the outcome you described is exactly the MVP threshold that matters: once a project’s .reffy/ state can be pushed and addressed remotely in a reliable way, you no longer need to manually shuttle planning/context files between repos. At that point, another project or tool can fetch the relevant remote .reffy documents directly instead of relying on vendored copies or ad hoc sharing.

The main thing to preserve as you move into the Reffy repo is discipline around identity and retrieval:

local manifest should remain the source of workspace identity
remote linkage should stay explicit
remote fetch should stay deterministic before it becomes “smart”
If you want, the next useful artifact on the Paseo side would be a short backend-facing note about what guarantees Reffy should be allowed to assume from reffyRemoteBackend.v1.
