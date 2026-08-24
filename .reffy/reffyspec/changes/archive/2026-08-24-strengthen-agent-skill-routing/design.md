## Context
Reffy uses a progressive-disclosure model: repository-level `AGENTS.md` content is expected to be loaded automatically, while task-specific procedures live under `.reffy/skills/` and are loaded only when relevant. The current generated root block names Reffy ideation and planning concepts but does not name remote workspace intent. Its single generic skill-discovery sentence also does not define a selection sequence. The detailed `sync-remote` skill exists, but agents can miss the path that leads to it.

### Problem Summary
- The always-loaded fixture does not recognize common remote-workspace phrasing as Reffy intent.
- Skill discovery is advisory but not operationally ordered, so merely mentioning `reffy skill list` does not ensure that a matching skill body is read.
- The `sync-remote` frontmatter triggers cover only a narrow set of phrases and omit common shared-reference language.

## Goals / Non-Goals
- Goals:
  - Make a harness that follows repository `AGENTS.md` reliably discover the appropriate Reffy skill.
  - Make remote-workspace and shared-reference requests route to `sync-remote` without requiring the user to mention Reffy explicitly.
  - Preserve progressive disclosure by keeping task procedure details in `SKILL.md` files.
  - Keep `reffy init` idempotent and responsible for refreshing the managed guidance and managed skill metadata.
- Non-Goals:
  - Automatically execute `reffy remote push` or any other remote mutation when an agent session begins.
  - Add bidirectional synchronization, new remote commands, or changes to authentication and remote protocols.
  - Make harnesses that ignore repository `AGENTS.md` discover Reffy; harness-specific adapter files are a separate compatibility concern.
  - Inline the complete skill catalog or remote procedure into the root instruction block.

## Decisions
- Decision: Strengthen the existing managed instruction fixtures instead of adding another always-loaded file.
  - Rationale: `reffy init` already owns and refreshes the root Reffy block and `.reffy/AGENTS.md`; improving that established entry point fixes the gap with minimal new surface area.
- Decision: Express skill discovery as an ordered prerequisite.
  - Rationale: Agents need explicit sequencing: enumerate available skills, match request language against descriptions/triggers, read the selected `SKILL.md`, then follow it before running Reffy commands.
- Decision: Include a direct remote-workspace route in the root block.
  - Rationale: Remote workflows involve credentials, workspace identity, linkage, and snapshot-publication semantics. A direct route is short enough for the always-loaded layer and reduces unsafe reconstruction from memory.
- Decision: Expand `sync-remote` trigger metadata alongside the instruction change.
  - Rationale: Once an agent enumerates skills, terms such as `remote workspace`, `shared references`, and `publish references` must select the expected procedure.
- Decision: Do not automate remote execution from instructions.
  - Rationale: Discovery can be automatic, but remote publication requires credentials and may replace or prune remote state; command execution remains request-driven and governed by the skill.

## Fixture Shape
The root managed Reffy block should:

1. Recognize ideation, planning handoff, remote workspace, remote sync, shared references, and Paseo intent as reasons to load Reffy guidance.
2. Require skill enumeration and intent matching before any Reffy workflow.
3. Require the selected `SKILL.md` to be read before Reffy commands run.
4. Point remote-workspace requests directly to `.reffy/skills/sync-remote/SKILL.md`.

`.reffy/AGENTS.md` should repeat the ordered discovery prerequisite because it is the durable Reffy workflow guide. Detailed environment and command steps remain solely in the managed `sync-remote` skill.

## Verification Strategy
- Initialize a fresh temporary repository and assert that both generated instruction surfaces contain the ordered routing language.
- Assert that the root block recognizes remote-workspace intent and names the direct `sync-remote` path.
- Inspect `reffy skill list --output json` after initialization and assert that `sync-remote` exposes the expanded trigger vocabulary.
- Re-run `reffy init` and assert that the managed content refreshes idempotently without modifying unmanaged skills or unrelated user-authored `AGENTS.md` content.

## Reffy Inputs
- reffy-skills-directory.md

## Open Questions
- Should future harness-specific adapters mirror the root routing contract for tools that do not load `AGENTS.md`? This is explicitly deferred from the current change.
