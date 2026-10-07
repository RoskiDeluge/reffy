## Context
Reffy scaffolds a deliberately small ReffySpec document model, but its runtime currently discovers files permissively. Validation checks that required paths exist and parses any Markdown file immediately below a capability directory. Archive recursively moves the entire change directory. These independent behaviors admit unknown files without assigning them meaning.

The delta parser boundary is similarly split: validation recognizes four section names, while archive reparses deltas and rejects two of them. Manifest traceability is updated from the archive's list of files that still exist, leaving a deleted or replaced scaffold output untouched.

## Goals / Non-Goals

### Goals
- Make the supported active-change filesystem shape explicit, exhaustive, and machine-enforced.
- Ensure validation and archive consume the same structural and delta model.
- Make every change that passes semantic validation archiveable against the canonical specs observed during validation.
- Preserve only live, repository-local planning output links through archive.
- Return complete, actionable diagnostics without partially mutating planning state.

### Non-Goals
- Introduce an `attachments/` directory or another extension mechanism.
- Assign semantics to arbitrary documents already stored in historical archives.
- Migrate or delete unsupported files automatically.
- Make the multi-file archive operation generally transactional against I/O failure or concurrent filesystem mutation.
- Change the canonical `.reffy/reffyspec/` workspace location.

## Decisions

### Enforce one exhaustive active-change tree
The validator will enumerate the complete active change tree and compare it with this grammar:

```text
<change-id>/
├── proposal.md
├── tasks.md
├── design.md                 # optional
└── specs/
    └── <capability>/
        └── spec.md
```

Unknown top-level entries, non-directory entries directly under `specs/`, and entries other than `spec.md` inside a capability directory are errors. Validation collects every unexpected path before returning. Diagnostics include placement guidance rather than implying that unknown files can be ignored.

Strict enforcement begins with this change rather than a warning-only release. The paths were never part of the documented contract, while continued acceptance permits changes to pass validation and fail later or preserve semantically undefined material. Release notes and remediation text provide the compatibility path.

### Parse once for validation and archive
Planning code will expose a shared parsed delta representation for added, modified, removed, and renamed requirements. Validation will check syntax and canonical-spec preconditions before archive writes anything:

- `ADDED` names must not already exist in the current capability spec.
- `MODIFIED` and `REMOVED` names must exist.
- `RENAMED` entries use paired `FROM` and `TO` lines; the source must exist and the destination must not collide.
- Duplicate or conflicting operations in one delta are errors.
- Requirement blocks continue to require scenarios; rename pairs are structural operations and do not require their own scenario blocks.

Archive applies renames before modifications so a change can rename a requirement and then provide its complete modified body under the new name. Removal deletes the named requirement block, and rename without modification preserves the existing requirement body while changing its heading. Validation and archive will use the same normalization and conflict rules.

Because canonical specs can change between validation and archive, archive repeats the same preflight immediately before mutation. The guarantee applies to the filesystem state observed by that preflight.

### Preflight every mutation
Archive will finish change-tree validation, delta parsing, canonical-spec compatibility checks, archive-destination checks, and traceability reconciliation planning before writing canonical specs or moving the change. A failed preflight leaves the active change, canonical specs, and manifest unchanged.

### Treat local derived outputs as integrity links
Manifest validation will treat a repository-relative `derived_outputs` entry as a link to a real local file and report an error when the target is absent or not a file. During archive, traceability reconciliation will:

1. rewrite links for active files moved into the dated archive;
2. remove links beneath the archived active-change path when their source file no longer exists; and
3. preserve unrelated links unchanged.

This narrowly repairs stale scaffold links associated with the change being archived; it does not silently prune arbitrary missing links during ordinary validation.

### Keep guidance synchronized with enforcement
The README, generated ReffySpec instructions, and managed create/archive skills will say that the displayed tree is exhaustive. They will also direct supporting content to `design.md`, `tasks.md`, or indexed artifacts and document rename syntax. Runtime diagnostics will use the same vocabulary.

## Risks / Trade-offs
- Strict validation can block repositories that relied on undocumented sibling files. Clear diagnostics and release notes make the migration explicit.
- Semantic validation now depends on canonical spec state, adding reads and making validation sensitive to concurrent changes. Archive repeats preflight to avoid acting on stale results.
- Implementing removal and rename increases parser complexity. A shared representation and focused parser/merge tests reduce drift.
- Missing derived-output links that were previously tolerated will make `reffy validate` fail until repaired or archived through the targeted reconciliation path.

## Reffy Inputs
- `reffy-cli-rules-hardening.md`

## Open Questions
- None. An attachments extension can be proposed separately if a concrete indexed, displayed, and archived lifecycle is defined.
