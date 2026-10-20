---
name: create-artifact
description: Capture ideas, research, and exploratory notes as Reffy artifacts. Use when asked to record an idea, add a note, preserve research context, or reindex artifacts before formal planning.
compatibility: Requires the Reffy CLI and an initialized Reffy workspace.
metadata:
  reffy-managed: "true"
  reffy-commands: '["reffy reindex","reffy validate"]'
  reffy-triggers: '["new artifact","capture idea","add note","reindex"]'
---

## When to use this skill
Use this when you have raw ideation, exploration, or research context to capture before any formal planning.

## Steps
1. Write the context as a markdown file under `.reffy/artifacts/` with a clear, stable, kebab-case filename.
2. Run `reffy reindex` to add the new file to `.reffy/manifest.json`.
3. Run `reffy validate` to confirm the manifest still satisfies the v1 contract.
4. Confirm the artifact appears in the manifest with the expected name and id.

## Failure modes
- If `reffy validate` reports an invalid manifest, fix the reported entry before continuing — do not hand-edit ids.
- Keep artifacts exploratory; do not duplicate full proposal or spec content here.
