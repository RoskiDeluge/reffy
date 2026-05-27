# Change: Fix Plan Heading Prototype Collision

## Why
`reffy plan create` currently parses Markdown artifact sections into a plain object in `src/plan.ts`. When a normalized heading matches an inherited `Object.prototype` key such as `constructor`, the parser reads the inherited value instead of initializing a new section array and crashes with `TypeError: sections[current].push is not a function`.

This makes planning generation depend on incidental wording inside indexed artifacts. One present-day artifact heading can break `reffy plan create` for the whole workspace, including unfiltered runs and `--output json` automation paths.

## What Changes
- Harden Markdown section extraction in the planning generator so normalized artifact headings cannot collide with inherited object members.
- Preserve current planning-signal extraction behavior for recognized headings such as `problem`, `what changes`, `questions`, and `acceptance criteria`.
- Add regression coverage for indexed artifacts whose headings normalize to `constructor` or similar `Object.prototype` keys.

## Impact
- Affected specs:
  - `artifact-planning`
- Affected code:
  - `src/plan.ts`
  - planning generation tests in `test/cli.integration.test.ts`

## Reffy References
- `reffy_plan_create_constructor_heading_bug.md` - fetched from workspace `nuveris-v1` project `paseo-core`; documents the repro, root cause, and constrained fix shape for `extractMarkdownSections`.
