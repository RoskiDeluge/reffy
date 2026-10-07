## ADDED Requirements

### Requirement: Derived Planning Output Integrity
The system MUST treat repository-relative artifact `derived_outputs` values as integrity links to local planning files.

#### Scenario: Derived output target exists
- **WHEN** `reffy validate` inspects a repository-relative `derived_outputs` entry whose target is an existing file
- **THEN** the link passes derived-output integrity validation

#### Scenario: Derived output target is missing or not a file
- **WHEN** `reffy validate` inspects a repository-relative `derived_outputs` entry whose target is absent or is not a file
- **THEN** validation exits non-zero
- **AND** the error identifies the artifact and invalid output path
