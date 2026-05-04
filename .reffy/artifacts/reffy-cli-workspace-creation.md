# Reffy CLI Workspace Creation

## Why this artifact
If shared workspaces are becoming first-class remote collaboration containers, then the Reffy CLI should not stop at pushing source trees into already-existing workspaces.

It should also let users create those workspaces directly.

That is the missing lifecycle piece in the workspace-container model.

## Core point
There are now two distinct user actions:

1. push a local source project into an existing workspace
2. create a new workspace and begin projecting projects into it

If the CLI only supports the first, then workspaces are still not truly first-class from the user's perspective.

## Why the CLI should own this
Once a workspace is understood as:

- a shared planning container
- independent of any single source project
- capable of receiving contributions from many projects

then creating that workspace is no longer just backend provisioning detail.

It becomes part of the collaboration model itself.

That means the Reffy CLI is the natural place to expose it.

## Identity distinction
This also lines up with the identity model:

- `project_id` originates from the local source tree
- `workspace_id` may be selected, discovered, or newly created

The CLI already has the right context to manage both:

- local source identity
- remote workspace lifecycle

## Recommended CLI shape

The CLI should probably introduce an explicit workspace creation flow such as:

- `reffy workspace create <workspace_id>`

or:

- `reffy remote workspace create <workspace_id>`

The command should do something like:

1. create the remote workspace container
2. provision or register the workspace-scoped backend actor
3. store the resulting linkage locally
4. optionally push the current source project into that workspace immediately

## Important separation of concerns
Workspace creation should stay separate from normal push semantics.

That means:

- `push` should assume the workspace already exists
- `workspace create` should create the workspace container
- an optional convenience flag like `--create-if-missing` could exist later

But the default model should remain explicit.

That keeps the lifecycle legible.

## Why this matters
Without CLI-side workspace creation, the user story remains incomplete:

- a user can join or target a workspace
- but cannot originate a new collaboration space from the same tool surface

That is awkward if workspaces are meant to be real product objects.

## Main design judgment
If workspaces are first-class shared planning containers, then the Reffy CLI should let users create them directly, not only push into ones that already exist.

That keeps the full lifecycle in one place:

- create workspace
- link workspace
- push project into workspace
- collaborate across projects inside that workspace
