# Change: Consolidate Setup Into Init

## Why
Reffy currently exposes both `init` and `bootstrap` for first-run repository setup, but the commands now perform nearly the same work. This creates unnecessary choice during onboarding and makes the CLI harder to explain. The project should present one canonical setup command while preserving short-term compatibility for existing `bootstrap` users.

## What Changes
- Make `reffy init` the canonical repository setup command.
- Move bootstrap-only setup behavior into `init`, including artifact reindexing and first-run onboarding text.
- Keep `reffy bootstrap` as a compatibility alias that maps to `init` behavior.
- Update CLI help, tests, and README examples to present `init` as the primary setup path.

## Impact
- Affected specs: `reffy-workspace`
- Affected code: `src/cli.ts`, setup helpers, CLI integration tests, and `README.md`

## Reffy References
- `init-bootstrap-consolidation.md` - captures the rationale for making `init` the single canonical setup command while retaining a compatibility alias for `bootstrap`.
