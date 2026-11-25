# Changelog

User-facing changes to Reffy. Add notes under Unreleased as changes land; release preparation moves them into a dated version section.

Earlier releases are available in the [GitHub release history](https://github.com/RoskiDeluge/reffy/releases).

## [Unreleased]

### Fixed
- `reffy remote push --prune` excludes verified archive moves from the 5% deletion guard and still lists every planned deletion. Run `reffy init` to refresh the archive skill's fallback guidance when the guard refuses cleanup.

## [1.12.1] - 2026-11-24

### Changed
- The `archive-change` skill now covers republishing after an archive: preview with `reffy remote push --dry-run --prune`, and prune only when every path to be deleted belongs to the archived change's old location. Run `reffy init` to refresh the skill.

## [1.12.0] - 2026-11-24

### Changed
- **Breaking:** `reffy remote push` no longer deletes remote documents that are missing from the local `.reffy/` tree. It keeps them and lists them as "Kept on remote, not in this checkout", so a push from a branch that lacks another branch's plans no longer removes those plans. Push output now includes a plan (add, update, unchanged, and remote-only paths).

### Added
- `reffy remote push --dry-run` prints the push plan and changes nothing: no project registration, import, or `last_imported_at` update.
- `reffy remote push --prune` opts into deleting remote documents missing locally. A pruning push that would delete more than 5% of the project's remote documents is refused before any change and lists the affected paths; add `--force` to proceed.

### Upgrading
- Scripts that relied on `reffy remote push` to remove deleted documents from the remote must add `--prune`. Run `reffy init` in each project to refresh the `sync-remote` skill.

## [1.11.0] - 2026-10-22

### Added
- `reffy remote init --provision` sends an application descriptor (`name`, `description`, `owner`) when it creates a Paseo manager, so the application registers with the deployment's control plane with a name and owner instead of blank fields. `name` defaults to the workspace id and `description` to `--label` (or `Reffy workspace backend for <workspace-id>`); `owner` comes from `--owner`, `PASEO_APPLICATION_OWNER`, or `git config user.email`. Init output reports the stored application, and its id is saved as `application_id` in `.reffy/state/remote.json`.
- `reffy remote application get` and `reffy remote application set [--name] [--description] [--owner]` inspect and update the manager's application descriptor with `PASEO_TOKEN`.

### Upgrading
- Managers provisioned before this release have blank application descriptors. Describe them with `reffy remote application set --name <name> --description <text> --owner <owner>` from a repo linked to that manager.

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
