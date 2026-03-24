# Archive Modified Requirements Gap

## Summary
Archiving the approved `consolidate-setup-into-init` change exposed a gap in the native planning archive flow: `reffy plan archive` only supported `## ADDED Requirements` deltas and failed on valid `## MODIFIED Requirements` deltas.

## Why It Mattered
- Approved changes that update existing requirements could not be archived.
- Current spec state could not be finalized after implementation.
- The planning workflow was internally inconsistent because validation accepted `MODIFIED`, but archive rejected it.

## Resolution
- Extend archive handling so `MODIFIED` requirements replace matching requirements in the current spec.
- Keep `REMOVED` and `RENAMED` as unsupported until explicit archive semantics are implemented for them.
