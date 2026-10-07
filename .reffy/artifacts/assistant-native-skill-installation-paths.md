# Assistant-Native Skill Installation Paths

## Observation

APX installs its addon skills into the configured discovery path for each assistant: commonly `.claude/skills/apx/`, and `.agents/skills/apx/` for Codex. Reffy currently bootstraps its managed skills only under `.reffy/skills/`, making Reffy's internal workspace tree both the source of truth and the runtime discovery mechanism.

That works only when an assistant first reads Reffy's generated `AGENTS.md` routing. It misses harnesses that discover skills directly from their native skill directories, and makes Reffy skills less portable than APX addons despite using the same `SKILL.md` shape.

## Direction to explore

Keep `.reffy/skills/` as Reffy's canonical, CLI-managed source, but let `reffy init` install or project those skills into assistant-native locations. The destination should be adapter-configured—for example `.agents/skills/reffy/` for Codex and `.claude/skills/reffy/` for Claude—rather than hard-coded to one harness.

The design should define ownership and refresh semantics, avoid diverging copies, preserve user-authored skills, and decide whether projection uses generated copies, links, or thin forwarding adapters. The central question is whether `.reffy/skills/` remains a private authoring source while native directories become the public assistant-discovery surface.
