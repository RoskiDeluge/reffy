# Changelog

User-facing changes to Reffy. Add notes under Unreleased as changes land; release preparation moves them into a dated version section.

Earlier releases are available in the [GitHub release history](https://github.com/RoskiDeluge/reffy/releases).

## [Unreleased]

## [1.10.0] - 2026-10-20

### Added
- Strict Agent Skills validation, explicit legacy header migration, and opt-in native skill export with ownership protection and recovery.
- A project changelog, CI validation, and a release preparation workflow that proposes the version bump and dated release notes in a pull request.

### Changed
- Built-in skills use standard YAML headers, preserve optional metadata, and advertise their activation conditions in descriptions.
- Skill discovery includes file locations and diagnostics; CI checks generated skills against a pinned upstream reference validator.
- GitHub release notes use the matching changelog entry.

### Upgrading
- Upgrade the CLI with `npm install -g reffy-cli@latest` (or `pnpm add -g reffy-cli@latest`), then run `reffy init` in each project to refresh built-in skills and managed guidance.
- For custom skills using legacy headers, run `reffy skill migrate`, then `reffy skill validate --standard`.
- To install or refresh native skill copies under `.agents/skills/`, run `reffy skill export --target agents` after initialization and any migration. CLI upgrades and `reffy init` do not refresh native exports automatically; locally edited or untracked destinations produce conflicts instead of being overwritten.

## [1.9.5] - 2026-10-01

### Changed
- Manager actor creation through `reffy remote init --provision` requires and sends `PASEO_PROVISIONING_TOKEN`, with actionable errors for missing or rejected provisioning credentials. Joining an existing manager does not require that credential.
