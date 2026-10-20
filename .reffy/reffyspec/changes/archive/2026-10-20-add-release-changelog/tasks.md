## 1. Changelog and release helpers
- [x] 1.1 Add the changelog with unreleased skills/automation notes and verified historical context.
- [x] 1.2 Implement validation, tag-matching note extraction, and stable-version release preparation with invalid-input preflight and no-op repeats.
- [x] 1.3 Add package scripts, packaged changelog, and contributor/release documentation.

## 2. Workflow integration
- [x] 2.1 Add default-branch release preparation that creates a reviewable PR without overwriting existing branches or publishing.
- [x] 2.2 Add CI changelog validation and explicit workflow dispatch for release branches.
- [x] 2.3 Validate release notes before npm publication and reuse them in the GitHub release body.

## 3. Verification
- [x] 3.1 Add and run meaningful release-helper regression and CLI tests.
- [x] 3.2 Validate workflow YAML, inspect npm packaging, and run changelog/build/type/test checks.
- [x] 3.3 Validate the Reffy manifest and this planning change; record local verification limits.
