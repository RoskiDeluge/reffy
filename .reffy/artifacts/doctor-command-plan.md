# Feature Idea: `reffy doctor`

## Problem
Some users install Reffy without OpenSpec (or any SDD companion tool) and may not know whether their local setup is healthy for the intended ideation-to-planning workflow.

## Proposed Feature
Add a diagnostic command:

- `reffy doctor [--repo PATH] [--output text|json]`

The command checks core Reffy integrity and reports optional ecosystem integrations as warnings.

## Scope (Small)
- Verify `.references/` directory presence
- Verify `.references/manifest.json` exists and validates
- Verify root `AGENTS.md` and `.references/AGENTS.md` are present
- Check optional tool availability (for now: `openspec` on PATH)

## Output Behavior
- Text mode: human-readable checks with pass/warn/fail indicators
- JSON mode: machine-readable diagnostic payload

## Exit Code Rules
- Exit non-zero for core Reffy integrity failures (missing/invalid required files)
- Exit zero when core checks pass, even if optional tools are missing

## Why It Fits Reffy
- Improves onboarding confidence for new users
- Reinforces the Reffy→OpenSpec handoff expectations without hard-coupling dependencies
- Provides actionable setup diagnostics without mutating repository state

## Acceptance Criteria
- Runs in repositories with and without OpenSpec installed
- Distinguishes required failures from optional warnings
- Supports both text and json output modes
- Does not modify artifacts or manifest files

## Open Questions
- Should optional checks support multiple tool profiles (OpenSpec, other SDD tools)?
- Should doctor include an optional `--fix` mode in a future iteration?
