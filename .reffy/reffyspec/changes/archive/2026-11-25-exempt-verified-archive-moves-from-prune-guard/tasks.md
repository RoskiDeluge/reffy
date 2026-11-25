## 1. Implementation

- [x] 1.1 Classify remote-only active change files with identical counterparts in the outgoing archive snapshot and use that classification in the existing project-scoped guard.
- [x] 1.2 Use the same guard calculation for dry run and real push. Keep the full deletion list in text and JSON, and report verified move paths and the count used by the guard.
- [x] 1.3 Update the managed `archive-change` and `sync-remote` templates and their checked-in skill files. Document the threshold calculation and the keep-missing fallback after a refusal.
- [x] 1.4 Update the remote push help and README to describe the exemption.

## 2. Verification

- [x] 2.1 Cover the Durable Forms case with seven verified moves among 59 remote documents. Exercise a newly added archive copy and a retry after it has already been published.
- [x] 2.2 Cover mixed deletions, nested paths, exact change-ID matching, changed or absent content, and archive copies that exist only on the remote. Verify behavior at and above 5%.
- [x] 2.3 Verify that dry run is read-only, refusal precedes mutation, ordinary push keeps missing paths, and explicit `--force` still overrides refusal on a prune.
- [x] 2.4 Check that the generated archive skill directs an agent to keep-missing publication if a preview or a real prune is refused.
