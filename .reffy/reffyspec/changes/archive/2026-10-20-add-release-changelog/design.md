# Design: Curated changelog with automated release preparation

## Decisions
Keep user-facing notes in `CHANGELOG.md` under `## [Unreleased]`, with optional Added/Changed/Fixed category headings. Released sections use `## [X.Y.Z] - YYYY-MM-DD`, newest first. Start v1.9.5 with its documented provisioning-credential change and the release commit's UTC date (2026-10-01); link earlier history instead of inventing it. Capture the skills-standard work under Unreleased.

`scripts/changelog.mjs` uses only Node built-ins. Pure helpers validate stable numeric X.Y.Z versions, date validity, unique descending release sections, nonempty released notes, and alignment between the newest release and package version. Preparation rejects invalid/downgrade/empty-note input before writing, moves notes to a UTC-dated release, resets Unreleased, preserves historical note content, and changes only the package version in package metadata. Preparing the already-current version is a no-op. Prerelease versioning is outside this initial workflow.

Preparation is explicit: `pnpm release:prepare X.Y.Z` locally or the Prepare Release workflow on the default branch. The workflow passes input through environment variables, commits only package/changelog files on a new `release/vX.Y.Z` branch, and opens a PR using a body file. It refuses existing branches rather than force-pushing. A rerun after a remote interruption preserves the branch; documentation explains manually opening its PR or dispatching CI. No automatic merge, tag creation, or npm publication is added.

Use `GITHUB_TOKEN` with contents/pull-requests/actions write permissions, and require the repository setting permitting Actions to create PRs. Explicitly dispatch `ci.yml` on the generated branch so testing does not depend on implicit bot push/PR triggers. Add workflow_dispatch support to CI. Workflow dispatch must be available on the default branch before use. [GitHub workflow trigger documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

CI checks changelog/package alignment. On a release tag, validate exact tag/package alignment and nonempty notes before npm publication; the GitHub release job checks out the tagged source and extracts the same notes into the existing release action's body_path. Keep npm provenance and the existing already-published-version behavior. Include CHANGELOG.md in the npm file allowlist. Preparation does not require installing dependencies; CI still runs the existing build/test gates.

## Verification
Exercise version transitions, notes extraction, history preservation, UTC dates, empty notes, malformed/duplicate headings, numeric ordering, tag mismatches, idempotent retries, and invalid-input file preservation. Parse the workflow YAML and inspect the npm pack file list locally. Live GitHub PR creation, workflow execution, tag creation, and npm publication are outside local verification.

## Implementation verification (2026-10-19)
- `pnpm build`, `pnpm check`, and `pnpm changelog:check` passed.
- Full test suite: 196 tests passed, including 17 release-helper/CLI tests; the existing coverage gate passed.
- All three workflow YAML files parsed successfully. `npm pack --dry-run --json --ignore-scripts` confirmed CHANGELOG.md is included.
- Manifest and change validation passed. The package remains at 1.9.5; local tests prepared newer versions only in temporary fixtures.
- Live release PR creation, GitHub CI dispatch, npm publication, and tag pushes were not performed. The workflow becomes available once merged to the default branch, with Actions PR creation enabled in repository settings.
