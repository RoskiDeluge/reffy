## ADDED Requirements
### Requirement: Prototype-Safe Artifact Section Parsing
The planning subsystem SHALL parse indexed Markdown artifacts without failing when a normalized heading matches an inherited `Object.prototype` property name.

#### Scenario: Indexed artifact heading normalizes to constructor
- **WHEN** `reffy plan create` processes indexed artifacts and one artifact contains a heading whose normalized form is `constructor`
- **THEN** the planning workflow completes without throwing a type error while collecting artifact sections
- **AND** the generated planning outputs remain available for the selected change id
- **AND** the user does not need to exclude the artifact with `--artifacts` to avoid the crash

#### Scenario: Indexed artifact heading normalizes to another inherited key
- **WHEN** `reffy plan create` processes indexed artifacts and one artifact contains a heading whose normalized form matches another inherited object key such as `toString` or `hasOwnProperty`
- **THEN** section parsing treats that heading as ordinary artifact input
- **AND** planning generation remains available for the full indexed workspace
