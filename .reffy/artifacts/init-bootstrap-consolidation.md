# Init And Bootstrap Consolidation

## Summary
`reffy init` and `reffy bootstrap` now overlap heavily. Both commands prepare the `.reffy/` workspace, prepare the `reffyspec/` layout, and write the managed `AGENTS.md` files. The remaining differences are artifact reindexing and the first-run onboarding message.

## Recommendation
Make `reffy init` the single canonical setup command. Move the remaining bootstrap-only behavior into `init`, and keep `reffy bootstrap` as a compatibility alias for at least one release cycle so existing docs and scripts do not break immediately.

## Why
- Reduces user confusion during first-run setup.
- Gives the CLI one obvious entrypoint for repository initialization.
- Preserves backward compatibility while simplifying docs and help text.

## Risks
- Some users may still rely on `reffy bootstrap` in scripts.
- Help text, docs, and tests need to be updated together to avoid drift.
