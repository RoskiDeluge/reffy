# Reffy Remote Sync Direction

## Why this artifact
This is a companion note to `reffy-cli-step1-mvp.md`.

That artifact is strong on CLI shape and product posture.
What it does not fully pin down yet is the sync contract underneath the commands.

That contract matters because the moment `.reffy/` has a remote representation, Reffy is no longer only a local planning tool.
It becomes a workspace sync system with identity, transport, and audit rules that later features will inherit.

## Main judgment
The first remote sync path should behave like snapshot publication, not like collaborative file sync.

That means step 1 should optimize for:
- one authoritative local source
- one explicit publish action
- one inspectable remote snapshot
- zero hidden merge behavior

This keeps the mental model small:

"Local `.reffy/` is the source of truth. `reffy remote push` publishes a new remote snapshot."

That is clearer than treating the backend as a live filesystem from day one.

## The most important missing concept: revisioned snapshots
If the backend only stores "current documents," the system will work at first but become hard to reason about once users ask:
- what changed
- whether a push was partial
- whether the remote view is stale
- whether two projects published incompatible state

So even if the user-facing MVP remains simple, the backend contract should probably include:
- a workspace identity
- a current revision id
- a snapshot timestamp
- a document count
- a content hash or manifest hash for the pushed tree

The CLI does not need to expose all of that immediately, but it should be built on top of it.

## Suggested remote model
I would think about the remote backend as three layers:

### 1. Workspace record
Represents the stable identity:
- `project_id`
- `workspace_name`
- workspace-level metadata

### 2. Snapshot record
Represents one publish event:
- `revision_id`
- `created_at`
- `source_manifest_updated_at`
- total document count
- aggregate hash

### 3. Document records
Represents path-addressable content within a snapshot:
- `path`
- `mime_type`
- `size_bytes`
- content hash
- raw content or content pointer

With that structure, step 1 can still present only:
- `init`
- `status`
- `push`
- `ls`
- `cat`

But the backend will already be shaped for later:
- revision history
- selective fetch
- remote diffing
- sharing or promotion workflows

## Push should be idempotent at the snapshot boundary
The CLI should not think in terms of "upload files one by one until we seem done."
It should think in terms of:

1. scan `.reffy/`
2. build a deterministic import payload
3. publish a snapshot
4. receive a snapshot result
5. verify identity and counts

That gives cleaner failure semantics.
If a push fails, the backend should not expose a half-updated workspace as the new truth unless it explicitly marks the snapshot as incomplete.

The best version is atomic snapshot replace.
If full atomicity is too heavy for the MVP, the API should at least behave as if the final "current revision" pointer changes only after import success.

## Local identity and remote linkage should stay split
I agree with the source note that `.reffy/manifest.json` should own:
- `project_id`
- `workspace_name`

I would keep remote linkage elsewhere.

The practical reason is not just cleanliness.
It is that cross-project sharing usually implies multiple deployment contexts over time:
- local dev backend
- hosted team backend
- temporary testing actor

If those connection details live in the manifest, the repo starts mixing workspace identity with deployment state.

I would lean toward a Reffy-managed local config file such as:
- `.reffy/remote.json`
or
- `.reffy/state/remote.json`

The second option is cleaner if Reffy eventually tracks more machine-local state.

## Path semantics should be strict and repo-relative
The backend should treat document paths as normalized `.reffy/`-relative paths, not arbitrary filesystem paths.

That means the payload should never contain:
- absolute paths
- `..` traversal
- platform-specific separators

It should only contain stable logical paths like:
- `artifacts/foo.md`
- `reffyspec/project.md`
- `manifest.json`

This will matter later when remote data is consumed across projects and platforms.

## Status should compare identities, not just connectivity
`reffy remote status` should tell the user more than "backend reachable."

The useful questions are:
- does local identity match the linked remote workspace
- what revision is current remotely
- when was it published
- how many documents exist
- does the local tree hash match the last pushed hash, if known

If hash comparison is too much for step 1, a local cached "last pushed revision" is still worth considering.

## Cross-project sharing changes the bar for metadata
If the remote service is meant to help `.reffy/` move across projects, the backend should preserve enough metadata for consumers to know what they are reading.

At minimum that suggests storing:
- source `project_id`
- source `workspace_name`
- source revision id
- publish timestamp
- manifest timestamps when available

Without that, downstream consumers will end up treating remote data as anonymous blobs.

## Recommended step 1 boundary
I would define the MVP boundary like this:

- One-way sync only: local to remote
- Full snapshot publish only
- Remote inspection only
- No remote-to-local write path yet
- No merge or conflict resolution
- No partial sync defaults

That keeps step 1 honest.
The moment pull or bi-directional sync appears, the product and failure model both become much more complicated.

## Concrete recommendation
If I were implementing this path, I would lock in these choices early:

1. Manifest is the stable workspace identity source.
2. Remote linkage is stored separately from the manifest.
3. `push` creates a new revisioned snapshot, even if the CLI hides most revision details at first.
4. Remote document paths are normalized `.reffy/`-relative logical paths.
5. The backend updates "current remote state" only after a successful import.
6. `status` reports identity alignment and current remote revision metadata, not just reachability.

That gives Reffy a clean base for later cross-project context sharing without prematurely turning step 1 into a sync engine.
