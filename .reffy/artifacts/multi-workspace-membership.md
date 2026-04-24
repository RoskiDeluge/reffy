# Multi-Workspace Membership

## Why this artifact
The current manifest identity model assumes that one `.reffy/` source tree belongs to one workspace.

That assumption is too narrow.

In practice, the same repository-local Reffy tree may need to participate in multiple higher-level planning contexts at once, especially if Nuveris is orchestrating cross-project planning and oversight.

## Main judgment
`project_id` and `workspace_name` should not be treated as if they have a 1:1 relationship.

What appears to be happening in current usage is:

- `project_id` identifies the source repository or source planning tree
- `workspace_name` is being used as if it were the one canonical planning container for that source

That is why duplicating the project id into the workspace field has felt natural.
But it is also why the model is now starting to break.

The stronger framing is:

- one `.reffy/` tree has one stable source identity
- that same tree may be projected into multiple workspaces
- workspace membership should therefore be modeled as plural, not singular

## Suggested manifest direction
The manifest should likely continue to own the stable source identity:

- `project_id`

But the workspace field should evolve from a single value into a collection.

For example, directionally:

```json
{
  "version": 1,
  "project_id": "my-project",
  "workspace_ids": [
    "my-project",
    "portfolio-alpha",
    "nuveris-cross-project-planning"
  ]
}
```

The exact field name can be debated, but the semantic move matters more than the spelling:

- singular workspace identity becomes multi-workspace membership

## Why this fits the broader Reffy direction
This is consistent with the idea that Reffy is becoming a planning/context layer above source code.

A source repository should not be forced into a single planning projection if higher-level orchestration wants to:

- group it into one portfolio workspace
- include it in another dependency-planning workspace
- expose it as part of a temporary initiative-specific workspace

That is especially plausible if Nuveris becomes the system deciding how multiple repositories are assembled into larger planning views.

In that world, a `.reffy/` tree is a reusable planning substrate, not a singleton workspace instance.

## Remote sync implications
This change would force a rethink of the current Paseo-backed remote push model.

Today, the remote linkage assumes a single workspace target.
That works for step 1, but it will not be enough if one local `.reffy/` tree can belong to multiple workspaces.

That raises questions such as:

- does `remote.json` link to one remote workspace or many
- is `remote push` publishing the source tree itself or publishing into one selected workspace projection
- should projection membership be encoded in the remote backend separately from source identity
- should Reffy support one source identity with multiple remote linkage entries

The key point is that remote publishing should probably stop assuming that "the source tree identity" and "the target workspace identity" are the same thing.

## Likely architectural split
The cleaner long-term model may be:

- manifest stores source identity and workspace memberships
- local state stores one or more remote linkage targets
- remote push operates against a selected projection or selected workspace target

That would preserve a clean distinction between:

- what this `.reffy/` tree is
- which workspaces it belongs to
- where it is currently being published

## Current recommendation
The right near-term move is not to immediately replace the field everywhere.

The right near-term move is to explicitly recognize that the current singular workspace field is conceptually wrong for the direction of the project.

That should lead to a future spec that:

- defines stable source identity separately from workspace membership
- replaces singular workspace identity with plural membership
- revisits how remote linkage and remote push should work when a source tree has multiple workspace projections

This matters because if Reffy is going to support Nuveris-level orchestration cleanly, it cannot assume that one repository-local planning tree maps to exactly one workspace forever.
