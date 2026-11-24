## Context
Push currently posts the full local document set to `POST /workspace/projects/{project_id}/import` with `replace_missing: true`, and the backend deletes anything for that project not in the payload. The CLI never sees what will be deleted until the response's `deleted` count. The RFP (`reffy-remote-rfp-git-checkout-sync.md`) asks for a plan-first push, a dry run, and a deletion guard on the CLI side, plus a preview endpoint and soft delete on paseo-core.

## Goals / Non-Goals
- Goals:
  - No remote document is deleted unless the user explicitly asks for pruning.
  - Users can see exactly what a push would add, update, and delete before it runs.
  - A pruning push that looks like a branch mismatch (large deletion share) stops before mutating anything.
  - Works against today's `reffyRemoteBackend.v2` without any paseo-core change.
- Non-Goals:
  - Git-ref-aware pushes, ref unions, or divergence reporting (later changes).
  - Server-side soft delete, provenance, or a preview endpoint (paseo-core's change).
  - Interactive confirmation prompts.

## Decisions
- Decision: Compute the plan client-side from `GET /workspace/projects/{project_id}/documents`.
  - Rationale: the listing already returns `path` and `content` per document, so the CLI can classify each path as add, update, unchanged, or delete by comparing paths and content. This unblocks the safety work now; when paseo-core ships a preview endpoint (CORE-3) the CLI can switch to it behind the same output contract.
- Decision: Default to `replace_missing=false`; `--prune` sends `replace_missing=true`.
  - Rationale: the backend already supports both modes, so keeping is a payload flag, not a new route. Making pruning opt-in is the single change that would have prevented the incident.
- Decision: No interactive confirmation; pruning requires the explicit `--prune` flag.
  - Rationale: pushes are routinely run by agents and scripts. A flag is predictable in both interactive and non-interactive runs and avoids a TTY-dependent code path. This is a deliberate narrowing of the RFP's "or confirms interactively".
- Decision: Mass-deletion threshold of 5% of the project's remote documents, overridden by `--force`.
  - Rationale: matches the RFP's example. The share is computed over this project's documents in the selected workspace, not the whole workspace, since other projects' documents are never pruned by this push. A push with zero remote documents never trips the guard.
- Decision: `--dry-run` performs only read calls (identity checks and the document listing).
  - Rationale: a dry run must not register the project, import, or write `last_imported_at`.
- Decision: The plan is computed immediately before import; a race with a concurrent push is accepted.
  - Rationale: atomic imports are paseo-core's CORE-4. The guard and default-keep mode already bound the damage.

## Risks / Trade-offs
- Listing a project with content on every push costs one extra round trip and transfers document bodies. Acceptable at current sizes (~190 documents); a content-hash field in the listing or the CORE-3 preview endpoint would remove it later.
- Users who relied on implicit pruning will accumulate stale remote documents until they pass `--prune`. The output lists kept remote-only paths so this stays visible.

## Reffy Inputs
- reffy-remote-rfp-git-checkout-sync.md

## Open Questions
- Should the 5% threshold be configurable (flag or linkage setting), or stay fixed until there's a concrete need?
