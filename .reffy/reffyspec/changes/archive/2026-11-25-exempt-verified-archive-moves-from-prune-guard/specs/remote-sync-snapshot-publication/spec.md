## MODIFIED Requirements

### Requirement: Mass-Deletion Guard
`reffy remote push --prune` SHALL refuse to run when planned deletions other than verified archive moves exceed 5% of the selected project's pre-push remote document count, unless the user also passes `--force`. The CLI SHALL verify an archive move only when a remote-only document under `.reffy/reffyspec/changes/<change-id>/<relative-path>` has identical content to a document in the outgoing snapshot under `.reffy/reffyspec/changes/archive/<YYYY-MM-DD>-<change-id>/<relative-path>`. Dry runs and real pushes SHALL use the same verification and guard calculation. Prune reporting SHALL retain the complete deletion list and identify the verified move paths and the deletion count used by the guard in text and JSON.

#### Scenario: Verified archive cleanup exceeds the threshold by raw count
- **WHEN** a user runs `reffy remote push --prune` without `--force`
- **AND** all seven planned deletions in a 59-document remote project have verified archive counterparts in the outgoing snapshot
- **THEN** the guard counts zero deletions and allows the push
- **AND** the import payload includes the archive counterparts whether they are newly published or already present on the remote
- **AND** the output lists all seven deleted paths and identifies each as a verified archive move

#### Scenario: An archive counterpart cannot be verified
- **WHEN** a planned deletion has an archive candidate with a different change ID, relative path, or content
- **OR** the remote source content is unavailable or the matching archive copy is absent from the outgoing snapshot
- **THEN** the CLI counts that deletion toward the threshold
- **AND** a deletion of an existing archive path also counts toward the threshold

#### Scenario: Pruning push exceeds the deletion threshold
- **WHEN** a user runs `reffy remote push --prune` without `--force`
- **AND** the count after excluding verified moves exceeds 5% of the project's pre-push remote documents
- **THEN** the command fails before registering the project or importing any document
- **AND** the output lists every path that would have been deleted and explains that `--force` overrides the guard

#### Scenario: Mixed deletions are at the threshold
- **WHEN** a pruning push contains verified moves and other planned deletions
- **AND** the other deletions account for exactly 5% of the project's pre-push remote documents
- **THEN** the guard allows the push and includes both kinds of deletion in the plan

#### Scenario: Pruning dry run shows how the guard applies
- **WHEN** a user previews a pruning push with `--dry-run`
- **THEN** the output includes the full deletion list, the verified archive move paths, the count used by the guard, and the guard result
- **AND** the preview leaves remote documents and local linkage state unchanged

#### Scenario: Forced pruning push exceeds the threshold
- **WHEN** a user runs `reffy remote push --prune --force`
- **AND** the count after excluding verified moves exceeds the threshold
- **THEN** the push proceeds with pruning
- **AND** the output lists each deleted path

#### Scenario: Force is passed without prune
- **WHEN** a user runs `reffy remote push --force` without `--prune`
- **THEN** the command fails before any network request
- **AND** the output explains that `--force` only applies to pruning pushes
