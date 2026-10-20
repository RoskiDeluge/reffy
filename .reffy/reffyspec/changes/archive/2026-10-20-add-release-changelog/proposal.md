# Change: Add a changelog and CI release preparation

## Why
Reffy has tag-triggered npm publication and generated GitHub notes, but no repository changelog. A curated changelog gives users a stable summary and lets version preparation, release validation, and GitHub notes share one source.

## What Changes
- Add root `CHANGELOG.md` with an Unreleased section, verified v1.9.5 context, and a link to earlier releases.
- Add dependency-free scripts to validate notes, prepare a newer stable package version with dated notes, and extract tag-matching release notes.
- Add a manually dispatched Prepare Release workflow that opens a version/changelog PR and explicitly dispatches CI for its branch.
- Validate the changelog in CI, use its matching section for GitHub release notes, and include it in npm packages.
- Document authoring, repository permissions, review/merge/tag steps, and interrupted preparation recovery.

## Impact
Affected spec: `release-changelog` (new). Affected files: root changelog, scripts/tests, package scripts/files, README, and CI/release workflows. Existing npm trusted publishing and manual tag creation remain the release boundary. No workflow is dispatched, remote PR created, tag pushed, or package published during local implementation.

## Supersedes
None

## Reffy References
- `release-changelog-automation.md` — curated notes, reviewed preparation, tag-based publication, and CI integration direction.
