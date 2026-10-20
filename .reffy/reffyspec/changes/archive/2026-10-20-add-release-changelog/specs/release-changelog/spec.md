## ADDED Requirements

### Requirement: Repository Changelog
The project SHALL maintain and package a root CHANGELOG.md with an Unreleased section followed by uniquely versioned, dated release sections in descending stable-version order. Its newest release SHALL match package.json. Existing release history MAY be linked when reliable curated entries are unavailable.

#### Scenario: CI validates the repository changelog
- **WHEN** CI runs
- **THEN** changelog structure, release dates, nonempty release notes, unique numeric version ordering, and package-version alignment are checked
- **AND** invalid or missing release notes fail the check

### Requirement: Reviewable Release Preparation
The project SHALL provide local and manually dispatched CI preparation that moves nonempty Unreleased notes into a dated section and updates package.json together for a newer stable X.Y.Z version. Invalid preparation input SHALL fail before editing files, and preparing the current version SHALL be a no-op.

#### Scenario: Prepare a new release
- **WHEN** a maintainer supplies a valid newer stable version with Unreleased notes
- **THEN** preparation creates the matching UTC-dated section, resets Unreleased, preserves historical note content, and updates the package version
- **AND** workflow preparation creates a release PR and explicitly dispatches CI for its branch
- **AND** it does not merge, tag, or publish automatically

#### Scenario: Invalid input or repeat preparation
- **WHEN** preparation receives an invalid version, downgrade, invalid changelog, or empty Unreleased notes for a new version
- **THEN** it fails before changing release files
- **AND** preparing an already-current version makes no changes

#### Scenario: Existing release branch
- **WHEN** the preparation workflow encounters an existing release branch
- **THEN** it preserves that branch and reports manual recovery guidance instead of force-pushing

### Requirement: Changelog Based Release Notes
The tag-triggered release workflow SHALL require an exact tag/package match and nonempty corresponding changelog notes before publishing npm, and SHALL use those notes as the GitHub release body.

#### Scenario: Release notes align
- **WHEN** a matching version tag is released
- **THEN** the matching changelog section supplies the release notes
- **AND** npm trusted publishing and provenance remain enabled

#### Scenario: Tag or notes mismatch
- **WHEN** the tag disagrees with the package version or the matching notes are absent or empty
- **THEN** the workflow fails before npm publication
