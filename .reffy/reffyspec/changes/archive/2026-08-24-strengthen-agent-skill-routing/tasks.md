## 1. Managed instruction routing
- [x] 1.1 Update the root Reffy managed-block fixture to recognize remote workspace, remote sync, shared-reference publication, and Paseo intent.
- [x] 1.2 Replace the passive skill-discovery sentence with an ordered prerequisite to enumerate skills, match intent, and read the selected `SKILL.md` before running Reffy commands.
- [x] 1.3 Add the direct `.reffy/skills/sync-remote/SKILL.md` route for remote-workspace requests without inlining the remote procedure.
- [x] 1.4 Apply the same ordered skill-discovery prerequisite to the managed `.reffy/AGENTS.md` fixture.

## 2. Managed skill metadata
- [x] 2.1 Expand the built-in `sync-remote` triggers to include remote-workspace and shared-reference phrasing.
- [x] 2.2 Confirm `reffy init` refreshes the changed managed skill while preserving unmanaged skills.

## 3. Tests and documentation
- [x] 3.1 Update initialization integration tests to assert remote intent routing, ordered skill selection, and the direct `sync-remote` path.
- [x] 3.2 Update skill integration tests to assert the expanded `sync-remote` triggers in text or JSON discovery output.
- [x] 3.3 Update README guidance if it reproduces or summarizes the generated routing contract.

## 4. Verification
- [x] 4.1 Run the focused initialization and skill integration tests.
- [x] 4.2 Run `pnpm check` and `pnpm test`.
- [x] 4.3 Run `reffy validate` and `reffy plan validate strengthen-agent-skill-routing`.
- [x] 4.4 Inspect a freshly initialized repository to confirm routing is concise, idempotent, and preserves unrelated user-authored instructions.
