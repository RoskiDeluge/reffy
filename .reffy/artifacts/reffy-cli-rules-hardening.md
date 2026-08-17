# Reffy CLI Change-Layout Validation Findings

## Handoff summary

Reffy CLI `1.9.1` documents and scaffolds a small, opinionated ReffySpec change shape, but its validator and archiver currently tolerate arbitrary additional files inside a change directory. That tolerance can be mistaken for an extension mechanism even though no such mechanism is documented.

This happened in Imginate's `establish-unified-authentication` change. Five supporting documents were added beside the standard ReffySpec files:

- `dependency-compatibility.md`
- `implementation-inventory.md`
- `migration-runbook.md`
- `rollout.md`
- `verification-checklist.md`

They were useful working documents for a large security and migration effort, but they overrode ReffySpec's intended document model. Before archive, durable material was consolidated into `design.md` and `tasks.md`, the five extensions were removed, and the cleaned archive was rehearsed successfully.

The CLI should make the supported shape explicit and either reject extensions or define an intentional extension point. Silent tolerance leaves agents and developers unable to distinguish supported architecture from incidental filesystem behavior.

## Intended change model

The repository instructions, managed `create-change` skill, CLI README, and scaffold implementation consistently describe these files:

```text
.reffy/reffyspec/changes/<change-id>/
├── proposal.md
├── tasks.md
├── design.md                         # optional by documented contract
└── specs/
    └── <capability>/
        └── spec.md
```

Relevant implementation evidence in the installed `reffy-cli` package:

- `README.md:333-346` describes proposal, design, tasks, and capability delta files.
- `dist/plan.js:266-287` creates exactly those four scaffold outputs.
- The managed `create-change` skill instructs users to fill exactly those scaffolded outputs.

No inspected package instruction grants permission to add arbitrary sibling documents to a change.

## Why the unsupported files were created

The authentication change involved dependency compatibility, an authorization-surface inventory, a production data migration, staged rollout and rollback, and extensive release verification. Separate documents were created to keep each concern operationally manageable.

The mistaken inference was:

1. `reffy plan validate` accepted the additional files.
2. `reffy plan archive` could mechanically move them.
3. Therefore, additional change-local documents appeared to be supported.

The correct placement under the current model is:

- durable architectural and operational decisions in `design.md`;
- implementation and verification work in `tasks.md`;
- normative behavior in capability delta specs;
- genuinely exploratory context in `.reffy/artifacts/`, indexed through Reffy.

## Current behavior

### Validation ignores unknown files

`dist/plan-runtime.js:178-209` verifies that required files and a `specs/` directory exist, then validates discovered delta specs. It does not enumerate or reject unsupported paths in the change directory.

As a result, a change containing any number of arbitrary sibling files can report as valid.

### Archive preserves unknown files incidentally

`dist/plan-archive.js:21-34` recursively lists every file in the change directory. Lines `216-228` include all of those files in the path map and rename the entire directory into the archive. Only `specs/<capability>/spec.md` participates in canonical spec merging.

Therefore, extra files survive inside the archived history but have no defined semantic role in ReffySpec. Mechanical preservation is not the same as a supported extension contract.

## Minimal reproduction

```bash
reffy plan create --change-id demonstrate-layout-gap --title "Demonstrate layout gap"

# Fill the standard scaffold so it is otherwise valid.
# Then add an undocumented sibling file:
touch .reffy/reffyspec/changes/demonstrate-layout-gap/rollout.md

reffy plan validate demonstrate-layout-gap
# Current result: valid; rollout.md is not mentioned.

reffy plan archive demonstrate-layout-gap
# Current result: archive succeeds and carries rollout.md into the archive.
```

The reproduction should be performed in a disposable fixture because the archive command mutates canonical specs and planning paths.

## Recommended contract decision

Prefer a strict package-native layout unless Reffy intentionally introduces an extension mechanism.

Under a strict contract, validation should allow:

- top level: `proposal.md`, `tasks.md`, optional `design.md`, and `specs/`;
- within `specs/`: capability directories only;
- within each capability directory: `spec.md` only.

An actionable error could read:

```text
unexpected change file: rollout.md
Move durable decisions to design.md, checklist work to tasks.md, or exploratory context to .reffy/artifacts/.
```

If arbitrary supporting material is a desired feature, define it explicitly—for example, a documented `attachments/` directory—and specify whether it is indexed, validated, displayed, linked to artifacts, and retained during archive. The existing silent behavior should not serve as the extension API.

## Suggested CLI changes

1. Add a change-tree shape validator and run it from `reffy plan validate`.
2. Make `reffy plan archive` depend on that same strict structural result before performing any writes.
3. Report every unexpected path, not only the first, so cleanup takes one pass.
4. Document the allowed tree as exhaustive rather than merely listing required files.
5. Consider a compatibility rollout: warnings for unknown paths in one release, then errors in the next breaking or clearly announced release.
6. If an escape hatch is necessary, make it explicit and machine-readable rather than inferred from validator permissiveness.

## Suggested tests

- A standard scaffold validates.
- Omitting optional `design.md` validates.
- An unknown top-level file produces an actionable validation error.
- An unknown top-level directory produces an actionable validation error.
- An extra file beneath `specs/<capability>/` is rejected.
- Multiple unexpected paths are all reported.
- Archive refuses a structurally invalid change without moving files or modifying canonical specs.
- A documented extension directory, if introduced, has deterministic archive and manifest behavior.

## Related validation gaps observed

### Stale derived-output paths can remain valid

After the real authentication archive, `.reffy/manifest.json` still contained a linked `derived_outputs` entry for an earlier scaffold path that no longer existed:

```text
.reffy/reffyspec/changes/establish-unified-authentication/specs/establish-unified-authentication/spec.md
```

The archiver rewrites paths found in its active-file path map, so a scaffold output deleted or replaced before archive is not rewritten. `reffy validate` still reported the manifest as valid. Consider validating that every local `derived_outputs` path exists, or explicitly pruning superseded planning outputs when a change is archived.

### Delta support differs between documentation and archive

The ReffySpec instructions document `ADDED`, `MODIFIED`, `REMOVED`, and `RENAMED` requirement deltas. In `dist/plan-archive.js:81-89`, archive rejects every section except `ADDED` and `MODIFIED`.

If `REMOVED` and `RENAMED` are not yet implemented, validation should fail early with a capability message or the documentation should identify them as planned. Ideally validation and archive should share the same supported-delta contract so a change cannot validate successfully and then fail only at archive time.

## Desired outcome

A user or coding agent should be able to answer all of these questions from the CLI and managed instructions without inference:

- Which paths are valid inside a change?
- Are supporting documents extensible, and where do they belong?
- Will every validated delta operation archive successfully?
- Are all manifest-linked planning outputs present and current?

Making those contracts explicit will preserve Reffy's architecture while producing earlier, more actionable failures.
