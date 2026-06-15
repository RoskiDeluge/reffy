# Reffy Skills Directory

## Why this artifact
Reffy already does a good job of making its *data* surfaces deterministic: artifacts live in `.reffy/artifacts/`, planning truth lives in `.reffy/reffyspec/`, and agent instructions are injected through managed blocks in `AGENTS.md`.

What Reffy does not yet have is a deterministic surface for *procedures*.

Today, the knowledge of how to actually work with the Reffy CLI is scattered:

- the managed `AGENTS.md` blocks describe the workflow in prose, but they are one-size-fits-all and grow stale relative to the CLI
- repo-specific conventions (how this project names change IDs, when to archive, which artifacts feed which proposals) live in people's heads or in ad hoc notes
- every agent session re-derives the same command sequences (`reffy plan create`, `reffy plan validate`, `reffy plan archive`, `reffy remote push`) from scratch, sometimes incorrectly
- users who want to customize Reffy behavior have nowhere structured to put that customization except editing prose instructions

The proposal in this artifact is a `skills/` directory inside the existing `.reffy/` tree: a place where reusable, named, agent-readable procedures for working with the Reffy CLI live as files, are validated by the CLI, and can be authored by both Reffy itself and the user.

## The key distinction
A skill is not documentation and it is not a spec.

- `.reffy/reffyspec/specs/` answers *what is true* about the system's capabilities
- `.reffy/artifacts/` holds *exploratory thinking*
- `AGENTS.md` managed blocks answer *how to behave in general*
- a skill answers *how to perform one specific, repeatable task* with the Reffy CLI, in this repository, step by step

That distinction matters because it tells us what the format needs: skills must be small, individually addressable, individually discoverable, and safe to load on demand — not one giant instruction file that every agent pays for on every turn.

## What should live in `.reffy/skills/`
Each skill is a directory containing a single entry file plus optional support files:

```
.reffy/
└── skills/
    ├── create-change/
    │   └── SKILL.md
    ├── archive-change/
    │   └── SKILL.md
    ├── sync-remote/
    │   ├── SKILL.md
    │   └── checklist.md
    └── <user-defined>/
        ├── SKILL.md
        └── scripts/...
```

`SKILL.md` carries a small YAML frontmatter header and a markdown body:

```markdown
---
name: create-change
description: Turn one or more ideation artifacts into a ReffySpec change proposal.
triggers: ["new change", "plan create", "turn artifact into proposal"]
commands: ["reffy plan create", "reffy plan validate"]
managed: true
---

## When to use this skill
...

## Steps
1. Pick the source artifacts in `.reffy/artifacts/` ...
2. Run `reffy plan create --change-id <kebab-id> --artifacts <files>` ...
3. Fill in the scaffolded `proposal.md`, `tasks.md`, and spec deltas ...
4. Run `reffy plan validate <change-id>` and resolve every error ...

## Failure modes
- If validation reports a missing scenario block ...
```

Design choices embedded in that format:

- **Frontmatter is the index.** `name`, `description`, and `triggers` are enough for an agent to decide whether to load the body. The body is read only when the skill is actually needed. This is the progressive-disclosure model that agent harnesses (Claude Code and others) already converge on, so a `SKILL.md`-per-directory layout is interoperable rather than Reffy-proprietary.
- **`commands` declares which CLI commands the skill wraps.** That gives `reffy doctor` and `reffy validate` something mechanical to check: if a skill references a command or flag the installed CLI version does not have, the skill is stale and the CLI can say so.
- **`managed: true` marks skills Reffy owns.** Managed skills are scaffolded and refreshed by `reffy init`, exactly like the managed `AGENTS.md` blocks. User-authored skills omit the flag and are never touched by the CLI.

## Why this helps users, not just agents
The same files serve humans:

- `reffy skill list` becomes a task-oriented help system ("what can I do here?") that complements the flag-oriented `--help`
- `reffy skill show create-change` prints the procedure, so the skill body doubles as runnable documentation
- a team can encode its own conventions (naming rules, review gates, when to push to the Paseo remote) as custom skills that every agent and every new contributor picks up automatically

This is the customization surface Reffy currently lacks: today the only way to change how agents use Reffy in a given repo is to hand-edit prose around the managed blocks. A custom skill is structured, validated, and individually versioned in git.

## What the CLI should implement

### 1. Scaffolding on `reffy init`
`init` creates `.reffy/skills/` and writes the built-in managed skills covering the core workflows the CLI already has:

- `create-artifact` — capture ideation, run `reffy reindex`, confirm the manifest entry
- `create-change` — artifacts → `reffy plan create` → fill scaffolds → `reffy plan validate`
- `archive-change` — completion checks → `reffy plan archive` → verify spec merge
- `inspect-specs` — `reffy spec list` / `reffy spec show` to ground work in current truth
- `sync-remote` — `reffy remote status` / `push` / `snapshot` flow with the env vars it needs
- `diagnose` — `reffy doctor`, `reffy validate`, and what to do about each failure class

Re-running `init` refreshes managed skill bodies in place (they are CLI-owned), and never touches unmanaged ones.

### 2. A `reffy skill` command group
```
reffy skill list                 # name + description + managed flag, honors --output json
reffy skill show <name>          # print SKILL.md body
reffy skill create <name>        # scaffold an unmanaged skill from a template
reffy skill validate [<name>]    # frontmatter contract + command references exist
```

`--output json` on `list`/`show` matters more than it looks: it lets an agent harness enumerate skills programmatically and feed `description`/`triggers` into its own skill-discovery machinery without parsing markdown.

### 3. Validation integrated into existing flows
- `reffy validate` extends to the skills contract: required frontmatter fields, unique names, kebab-case directory names matching `name`
- `reffy doctor` cross-checks each skill's `commands` list against the actual command table of the installed CLI and warns on drift — the same staleness philosophy as the project-context-sync direction, applied to procedures instead of context

### 4. Discovery wiring in the managed `AGENTS.md` blocks
The managed block gains one stable paragraph: "Before performing a Reffy workflow, check `.reffy/skills/` (or run `reffy skill list`) and follow the matching skill." That keeps the always-loaded instruction surface small and pushes the detail into on-demand files.

## Candidate approaches considered

### Option 1: Keep everything in AGENTS.md managed blocks
Grow the existing prose instructions to cover every workflow in detail.

Pros: no new surface, no new commands.

Cons: every agent pays the full token cost on every session; no per-repo customization without fighting the managed block; no machine-checkable staleness; one file cannot serve six workflows well.

Judgment: this is the status quo failing slowly. Too weak.

### Option 2: A Reffy-proprietary skills schema (JSON definitions, executable hooks)
Define skills as structured JSON with executable steps the CLI runs itself.

Pros: fully deterministic execution.

Cons: skills stop being readable instructions and become a plugin system; it raises security and sandboxing questions Reffy does not need yet; it is incompatible with how agent harnesses actually consume skills today (markdown + frontmatter).

Judgment: too aggressive, and aimed at the wrong consumer.

### Option 3: Markdown SKILL.md directories, managed/unmanaged split, CLI-validated
The shape described above: files agents read, frontmatter the CLI validates, managed skills the CLI refreshes, unmanaged skills the user owns.

Pros: matches Reffy's existing managed-block philosophy; interoperable with the de facto SKILL.md convention; cheap to implement (scaffolding + a small command group + validation rules); customization becomes first-class.

Cons: skills are advisory, not enforced — an agent can still ignore them; body quality is on the author.

Judgment: the strongest baseline.

## Recommended direction
1. Add `.reffy/skills/` to the workspace contract, scaffolded by `reffy init` with the six built-in managed skills.
2. Adopt `SKILL.md`-per-directory with the frontmatter contract above; keep it intentionally compatible with the broader agent-skills convention rather than inventing a Reffy-only schema.
3. Implement the `reffy skill` command group (`list`, `show`, `create`, `validate`) with full `--output json` support.
4. Extend `reffy validate` and `reffy doctor` to cover the skills contract and command-reference staleness.
5. Update the managed `AGENTS.md` blocks to route agents through skill discovery instead of inlining procedure detail.

## Important design constraints
- **Skills never become a second source of capability truth.** They reference specs and commands; they do not restate requirements. If a skill needs to explain what a capability *is*, that text belongs in a spec and the skill should point at it.
- **Managed skills must be regenerable, not precious.** Anything a user would be sad to lose on `reffy init` belongs in an unmanaged skill.
- **The manifest stays an artifact index.** Skills are discovered from the filesystem and validated by contract, like `reffyspec/` content — they do not need `manifest.json` entries.
- **No executable steps in v1.** Skills are instructions plus optional support files. If executable automation is ever wanted, that is a separate, explicitly-scoped change.

## Near-term recommendation
This should become a ReffySpec change (likely `add-skills-directory`) that defines:

- the `.reffy/skills/` layout and the SKILL.md frontmatter contract as formal requirements with scenarios
- which skills ship as managed in v1 and the refresh semantics on `init`
- the `reffy skill` command surface, including JSON output shapes
- the validation and doctor rules, including command-reference staleness detection
- the wording change to the managed `AGENTS.md` blocks

The artifact-level decision is simpler: Reffy's procedures deserve the same treatment Reffy already gives its data — named files, deterministic locations, CLI validation, and a clean split between what the tool owns and what the user customizes.
