## ADDED Requirements

### Requirement: Exhaustive Active Change Document Model
Project documentation and managed guidance MUST present `proposal.md`, `tasks.md`, optional `design.md`, and `specs/<capability>/spec.md` as the exhaustive supported active-change document model.

#### Scenario: Contributor needs supporting planning material
- **WHEN** a contributor consults CLI documentation or managed ReffySpec guidance about files inside an active change
- **THEN** the guidance states that arbitrary additional change-local files and directories are unsupported
- **AND** it directs architectural and operational decisions to `design.md`, actionable checklists to `tasks.md`, and exploratory context to indexed `.reffy/artifacts/`

#### Scenario: Contributor authors a rename delta
- **WHEN** a contributor consults guidance for `RENAMED Requirements`
- **THEN** the guidance documents paired `FROM` and `TO` requirement headings
- **AND** the documented format matches the validator and archiver contract
