---
name: inspect-specs
description: Inspect canonical ReffySpec requirements and scenarios. Use when asked what current specs say, to list or show specs, or to ground a proposal or implementation in current behavior.
compatibility: Requires the Reffy CLI and an initialized Reffy workspace.
metadata:
  reffy-managed: "true"
  reffy-commands: '["reffy spec list","reffy spec show"]'
  reffy-triggers: '["inspect specs","current truth","spec list","spec show"]'
---

## When to use this skill
Use this before drafting a change or implementing behavior, to confirm what the specs already say.

## Steps
1. Run `reffy spec list` to enumerate capabilities and their requirement counts.
2. Run `reffy spec show <capability>` to read the requirements and scenarios for a capability.
3. Reference the relevant spec from your proposal or skill rather than restating its requirements.

## Failure modes
- If a capability is missing, it likely needs a new `ADDED` delta in a change rather than an edit to canonical specs.
