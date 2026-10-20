# Release changelog automation

Reffy currently publishes npm packages on `v*` tag pushes and generates GitHub release notes, but has no repository changelog. Recent release commits are not consistently conventional commits, so automatically categorizing commit subjects would give uneven user-facing notes.

Keep a curated root `CHANGELOG.md` with an `Unreleased` section. Contributors add meaningful behavior changes there. Release preparation should move those notes into a dated version section and update `package.json` together, through a reviewable PR created by a manually dispatched GitHub workflow. Keep tag creation and npm publication as the existing release boundary.

CI should validate changelog structure and require a section for the package version. Tag releases should validate the exact version and use that section as GitHub release notes. The changelog should ship in the npm package. The release preparer should reject empty notes, invalid/non-increasing versions, and duplicate releases before changing files; rerunning the same preparation should be idempotent.

Use GitHub's built-in token for release PR creation, with repository permissions configured to allow PRs. Explicitly dispatch CI for the generated branch so validation does not depend on implicit workflow triggers from bot pushes. Do not automatically merge, tag, or publish during release preparation.

Start with the verified v1.9.5 release commit date and provisioning-credential behavior. Link earlier release history rather than inventing historical entries. Record the skills-standard work and changelog automation as unreleased changes.
