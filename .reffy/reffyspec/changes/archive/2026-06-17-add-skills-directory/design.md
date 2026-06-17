## Context
Reffy already makes its data surfaces deterministic (artifacts, specs, managed `AGENTS.md` blocks) but has no deterministic surface for procedures. The knowledge of how to drive the CLI for a given workflow is re-derived every session and cannot be customized per repo except by hand-editing prose. The artifact `reffy-skills-directory.md` proposes a `.reffy/skills/` directory of named, agent-readable `SKILL.md` procedures validated by the CLI, with a managed/unmanaged split mirroring the existing managed-block philosophy.

## Goals / Non-Goals
- Goals:
  - Give procedures a named, deterministic, individually-addressable home under `.reffy/skills/`.
  - Adopt a `SKILL.md`-per-directory format with frontmatter that supports progressive disclosure (load the body only when the skill is needed).
  - Make skills machine-checkable: the CLI validates the frontmatter contract and detects command-reference staleness.
  - Make customization first-class: users author unmanaged skills the CLI never overwrites.
- Non-Goals:
  - No executable steps in v1. Skills are instructions plus optional support files, not a plugin/automation system.
  - Skills do not become a second source of capability truth — they reference specs and commands, never restate requirements.
  - Skills are not indexed in `manifest.json`; they are discovered from the filesystem and validated by contract, like `reffyspec/` content.

## Decisions
- Decision: Use `SKILL.md`-per-directory with YAML frontmatter (`name`, `description`, `triggers`, `commands`, `managed`).
  - Rationale: Frontmatter is the index — `name`/`description`/`triggers` are enough to decide whether to load the body. This matches the de facto agent-skills convention, so the layout is interoperable rather than Reffy-proprietary. (Artifact Option 3, the recommended baseline.)
- Decision: `commands` declares which CLI commands a skill wraps.
  - Rationale: Gives `reffy doctor`/`reffy validate` something mechanical to check — a skill referencing a command or flag the installed CLI lacks is stale and can be reported.
- Decision: `managed: true` marks CLI-owned skills; `init` scaffolds and refreshes them in place. Unmanaged skills omit the flag and are never touched.
  - Rationale: Mirrors the managed `AGENTS.md` block philosophy. Managed skills must be regenerable, not precious — anything a user would be sad to lose on `init` belongs in an unmanaged skill.
- Decision: Ship six built-in managed skills: `create-artifact`, `create-change`, `archive-change`, `inspect-specs`, `sync-remote`, `diagnose`.
  - Rationale: These cover the core workflows the CLI already exposes.
- Decision: Skills are discovered from the filesystem and not added to `manifest.json`.
  - Rationale: The manifest stays an artifact index; the skills contract is enforced by validation like `reffyspec/` content.
- Decision: The managed `AGENTS.md` block gains exactly one stable paragraph routing agents to skill discovery.
  - Rationale: Keeps the always-loaded instruction surface small and pushes procedure detail into on-demand files.
- Decision: `triggers` is a REQUIRED frontmatter field with at least one entry.
  - Rationale: A skill without triggers forces the agent back to searching around for the right commands, defeating the index. Requiring triggers keeps the frontmatter usable as a discovery surface.
- Decision: `reffy skill validate` stays its own subcommand under the `skill` group (in addition to the skills checks folded into `reffy validate`).
  - Rationale: A focused, skill-only validator is convenient for authoring loops without running the full workspace validation.
- Decision: `--output json` emits a harness-native descriptor shape (tool/function-definition style: `name`, `description`, `triggers`, `commands`, `managed`, `path`; `show` adds `body`), NOT OpenAPI.
  - Rationale: A skill is a named procedure, not an HTTP operation, so OpenAPI's path/operation/schema model fits poorly. The tool/function-definition convention (the `tools` array in the Anthropic/OpenAI APIs) is what agent harnesses already consume for discovery, so a flat descriptor maps directly onto their skill-discovery machinery.

## Alternatives Considered
- Keep everything in `AGENTS.md` managed blocks (grow the prose). Rejected: every agent pays the full token cost every session, no per-repo customization, no machine-checkable staleness, one file cannot serve six workflows well. This is the status quo failing slowly.
- A Reffy-proprietary skills schema (JSON definitions with executable hooks the CLI runs). Rejected: turns skills into a plugin system, raises security/sandboxing questions Reffy does not need yet, and is incompatible with how agent harnesses actually consume skills today (markdown + frontmatter).
- Markdown `SKILL.md` directories with a managed/unmanaged split, CLI-validated (chosen). Strongest baseline: matches Reffy's existing philosophy, interoperable, cheap to implement, and makes customization first-class. Trade-off: skills are advisory, not enforced — an agent can ignore them, and body quality is on the author.

## Risks / Trade-offs
- Skills are advisory, not enforced. Mitigation: wire discovery into the managed `AGENTS.md` block so agents are routed to skills by default; keep bodies short and accurate.
- Command-reference staleness depends on the CLI exposing an accurate command table. Mitigation: derive the doctor check from the same command registry the CLI uses for routing.
- Risk of skills drifting into restating spec content. Mitigation: enforce the design constraint in review — if a skill needs to explain what a capability *is*, that belongs in a spec and the skill points at it.

## Migration Plan
1. Add the `SKILL.md` parser, discovery, and the workspace-contract layout.
2. Author the six managed skill bodies and wire `init` scaffolding + in-place refresh.
3. Add the `reffy skill` command group with `--output json`.
4. Extend `reffy validate` and `reffy doctor` with the skills contract and command-reference staleness checks.
5. Update the managed `AGENTS.md` block and `README.md`.

## Reffy Inputs
- `reffy-skills-directory.md`

## JSON Output Shape
`reffy skill list --output json` returns an array of descriptors; `reffy skill show <name> --output json` returns one descriptor with the body attached:

```json
// reffy skill list --output json
{
  "skills": [
    {
      "name": "create-change",
      "description": "Turn one or more ideation artifacts into a ReffySpec change proposal.",
      "triggers": ["new change", "plan create", "turn artifact into proposal"],
      "commands": ["reffy plan create", "reffy plan validate"],
      "managed": true,
      "path": ".reffy/skills/create-change/SKILL.md"
    }
  ]
}

// reffy skill show create-change --output json
{
  "name": "create-change",
  "description": "Turn one or more ideation artifacts into a ReffySpec change proposal.",
  "triggers": ["new change", "plan create", "turn artifact into proposal"],
  "commands": ["reffy plan create", "reffy plan validate"],
  "managed": true,
  "path": ".reffy/skills/create-change/SKILL.md",
  "body": "## When to use this skill\n..."
}
```

## Open Questions
- None outstanding; the three prior open questions are resolved under Decisions above.
