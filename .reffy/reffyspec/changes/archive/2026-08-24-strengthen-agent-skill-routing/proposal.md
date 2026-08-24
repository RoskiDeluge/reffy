# Change: Strengthen agent skill routing

## Why
`reffy init` already writes managed `AGENTS.md` guidance that mentions `.reffy/skills/`, but the route is passive: remote-workspace intent is absent from the surrounding Reffy triggers and the instructions do not tell an agent how to select and load a matching skill. A harness can therefore handle a request such as "sync the remote workspace" without ever discovering the managed `sync-remote` procedure, leaving users to point it at the skill manually.

## What Changes
- Strengthen the root and `.reffy/AGENTS.md` managed fixtures with an ordered skill-discovery workflow: enumerate skills, match request intent to skill metadata, and read the selected `SKILL.md` before running Reffy commands.
- Add remote workspace, remote synchronization, shared-reference publication, and Paseo language to the always-loaded Reffy routing triggers.
- Route remote-workspace requests directly to `.reffy/skills/sync-remote/SKILL.md` while keeping credentials, identity, and command procedures out of the root instruction block.
- Expand the managed `sync-remote` skill triggers so common remote and shared-reference wording selects it reliably.
- Strengthen initialization tests to verify the routing contract and remote trigger coverage rather than only checking that `reffy skill list` appears somewhere.

## Impact
- Affected specs: `skills-directory`
- Affected code: managed instruction builders in `src/cli.ts`, the `sync-remote` managed skill in `src/skills.ts`, initialization/skill integration tests, and user-facing documentation if it reproduces the routing contract
- Compatibility: no CLI, manifest, remote protocol, or skill-file format changes; existing repositories receive refreshed managed instructions and managed skill metadata the next time they run `reffy init`

## Supersedes
_Optional. If this change reverses or replaces the direction of a prior change (a pivot, deprecation, or wind-down), name the prior change-id(s) here, e.g. `- add-old-direction`. Leave as "None" otherwise. The spec delta remains the authoritative record of what changed; this is a navigational pointer._
None

## Reffy References
- `reffy-skills-directory.md` - identifies the observed harness-discovery gap and recommends explicit remote intent routing plus ordered skill selection
