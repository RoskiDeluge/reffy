## MODIFIED Requirements

### Requirement: SKILL.md Frontmatter Contract
Each `SKILL.md` MUST begin with valid YAML mapping frontmatter containing standard-required `name` and `description`, followed by Markdown instructions. The system SHALL preserve standard optional `license`, `compatibility`, `metadata`, and `allowed-tools` fields. Generated files SHALL use only standard top-level fields; Reffy extensions SHALL be namespaced string values under `metadata`. Triggers SHALL be optional and descriptions SHALL be sufficient for skill selection.

#### Scenario: Minimal standard skill
- **WHEN** a skill declares only valid `name` and `description` fields followed by instructions
- **THEN** Reffy recognizes and validates it without requiring triggers, commands, or a managed declaration
- **AND** omitted Reffy extension values normalize to empty trigger/command arrays and unmanaged ownership

#### Scenario: YAML content and optional fields survive parsing
- **WHEN** a skill uses folded or literal descriptions, quoted values containing commas, or standard optional fields
- **THEN** parsed descriptions and values retain their YAML meaning
- **AND** optional fields remain available in records and JSON descriptors

#### Scenario: Reffy metadata encoding
- **WHEN** a generated skill declares Reffy ownership, commands, or supplementary triggers
- **THEN** those declarations use `metadata.reffy-managed`, `metadata.reffy-commands`, and optional `metadata.reffy-triggers` as strings
- **AND** command/trigger strings encode JSON arrays of strings
- **AND** the descriptor exposes normalized values without treating them as execution authorization

### Requirement: Managed Skill Scaffolding on Init
`reffy init` SHALL create `.reffy/skills/` and write the seven built-in managed skills with standard-conforming headers and independently useful descriptions. Re-running init SHALL refresh CLI-owned built-ins and SHALL NOT modify user-owned skill content or implicitly create native exports.

#### Scenario: Fresh initialization
- **WHEN** a workspace is initialized
- **THEN** standard-conforming `create-artifact`, `create-change`, `archive-change`, `supersede-change`, `inspect-specs`, `sync-remote`, and `diagnose` skills are written
- **AND** each declares its CLI/workspace dependency and managed ownership in standard fields

#### Scenario: Legacy managed refresh preserves custom skills
- **WHEN** init encounters legacy CLI-owned built-ins alongside user-owned skills
- **THEN** built-ins refresh to the standard header format
- **AND** user-owned skills and support files remain unchanged

#### Scenario: User ownership conflicts with a built-in name
- **WHEN** init encounters a valid user-owned skill at a reserved built-in path
- **THEN** it reports the ownership conflict and recovery guidance
- **AND** it does not overwrite that file

### Requirement: Skill Command Group
The CLI SHALL provide `skill list`, `show <name>`, `create <name>`, `validate [<name>] [--standard]`, `migrate [<name>]`, and `export --target agents`, supporting repository selection and text/JSON output. Existing list/show descriptor keys SHALL remain available; standard optional fields, absolute location, and structured diagnostics SHALL be additive. Listing SHALL exclude instruction bodies.

#### Scenario: Text discovery provides selection and loading information
- **WHEN** a user runs `reffy skill list`
- **THEN** each valid skill's name, description, managed state, and entry-file path are shown
- **AND** descriptions suffice for selection without fetching trigger metadata

#### Scenario: JSON discovery and activation
- **WHEN** list or show is requested with JSON output
- **THEN** descriptors retain `name`, `description`, `triggers`, `commands`, `managed`, and repository-relative `path`
- **AND** they include an absolute `location` and supplied standard optional fields
- **AND** only show includes the selected instruction body

#### Scenario: Malformed skill does not conceal valid siblings
- **WHEN** discovery encounters both malformed and valid skill files
- **THEN** valid records remain discoverable
- **AND** malformed records produce path/field diagnostics in text stderr or structured JSON diagnostics

#### Scenario: Custom scaffold is portable
- **WHEN** `reffy skill create my-workflow` scaffolds an unmanaged skill
- **THEN** the new header passes strict standard validation
- **AND** no required Reffy-only top-level fields are introduced

### Requirement: Skills Validation in `reffy validate`
`reffy validate` and `reffy skill validate` SHALL enforce YAML validity, required nonempty strings, unique skill names, directory/name agreement, and the standard's naming, length, and optional-field type constraints. Names SHALL be 1–64 Unicode code points of lowercase alphanumeric characters separated by single internal hyphens, descriptions 1–1,024 code points, and compatibility 1–500 code points when supplied. Metadata SHALL map strings to strings; license and allowed-tools SHALL be strings when supplied. Recognized legacy extensions MAY be accepted with warnings only in compatibility mode; `skill validate --standard` SHALL reject nonstandard top-level fields.

#### Scenario: Length and type boundaries
- **WHEN** a header exceeds a standard length limit, contains a non-string metadata value, or violates a required field type
- **THEN** validation fails with the skill, field, and violated constraint
- **AND** fixtures at the valid boundaries pass

#### Scenario: Name constraints and uniqueness
- **WHEN** a name differs from its directory, contains uppercase characters, edge/consecutive hyphens, or duplicates another skill name
- **THEN** validation fails with a specific diagnostic

#### Scenario: Invalid YAML or unsupported field
- **WHEN** a header contains invalid YAML, duplicate keys, a non-mapping root, or an unrecognized top-level field
- **THEN** validation fails rather than silently discarding or coercing the value

#### Scenario: Compatibility is distinguished from conformance
- **WHEN** a valid legacy Reffy header is validated in default mode
- **THEN** recognized legacy declarations produce deprecation warnings without making the command fail solely for those declarations
- **AND** the output does not claim standard conformance
- **AND** strict standard mode rejects the same top-level declarations

### Requirement: Command-Reference Staleness in `reffy doctor`
`reffy doctor` SHALL cross-check normalized skill command declarations against the installed CLI and warn about stale command or flag references. Normalization SHALL support both namespaced command metadata and recognized legacy command lists during migration.

#### Scenario: Both formats retain drift checks
- **WHEN** either a legacy command list or `metadata.reffy-commands` references an unavailable command or flag
- **THEN** doctor reports the skill and stale reference
- **AND** equivalent declarations in both formats produce equivalent command-drift results

#### Scenario: No command declaration
- **WHEN** a standard skill omits Reffy command metadata
- **THEN** no drift warning is generated solely because command metadata is absent

### Requirement: Skill Discovery Wiring in Managed AGENTS.md
Managed root and workspace AGENTS guidance SHALL direct agents to enumerate skills, select by description, load the selected entry file, and then follow it. Guidance SHALL document JSON discovery for programmatic consumers and resolve supporting file references relative to the selected skill directory. It SHALL retain remote intent coverage and SHALL NOT imply authorization for remote mutation merely from loading a skill.

#### Scenario: Description-first guidance after initialization
- **WHEN** init creates or refreshes managed guidance
- **THEN** the ordered discovery procedure works with text output, JSON output, or filesystem inspection
- **AND** selecting a skill does not require optional trigger extensions
- **AND** full procedure content stays in the selected skill

#### Scenario: Remote intent and user-authored guidance survive refresh
- **WHEN** managed guidance is refreshed
- **THEN** it continues routing remote workspace, synchronization, shared-reference publication, and Paseo intent to the remote skill
- **AND** it preserves unrelated user-authored AGENTS content and the requirement for task authorization before remote mutation

### Requirement: Supersede-Change Managed Skill
The built-in `supersede-change` description SHALL independently cover pivot, deprecation, wind-down, and reversal intent. Its instructions SHALL model such work as an ordinary superseding change, retain explicit lineage, and preserve append-only archive history.

#### Scenario: Selection without custom triggers
- **WHEN** a generic client sees only names and descriptions for a request to pivot, deprecate, wind down, or reverse a prior decision
- **THEN** the supersede-change description contains the relevant selection conditions
- **AND** its loaded instructions identify prior changes, author retirement/modification deltas, fill Supersedes, validate, and archive without editing old archive entries

### Requirement: Remote Sync Skill Intent Coverage
The built-in `sync-remote` description SHALL independently cover requests to inspect or publish a remote workspace, remote synchronization, Paseo, and shared references. Optional trigger metadata MAY supplement this description.

#### Scenario: Remote selection without custom triggers
- **WHEN** a generic client receives only skill names and descriptions for remote or shared-reference intent
- **THEN** sync-remote's description supplies the selection conditions
- **AND** loading its instructions supplies environment, identity, inspection, and publication procedures without granting mutation authorization

#### Scenario: Intent coverage refresh
- **WHEN** init refreshes an older CLI-owned sync-remote skill
- **THEN** the current description-first intent coverage is generated
- **AND** user-owned skills remain unchanged

## ADDED Requirements

### Requirement: Legacy Skill Header Migration
The CLI SHALL read recognized legacy `triggers`, `commands`, and `managed` top-level declarations with deprecation diagnostics and provide explicit `skill migrate [<name>]` conversion to standard headers. Migration SHALL preflight selected files, preserve instruction bodies and supporting files, retain standard fields and unrelated valid metadata, and reject conflicting declarations or unknown fields rather than lose data.

#### Scenario: Explicit user-owned migration
- **WHEN** a user migrates a valid legacy custom skill
- **THEN** its recognized extensions move into namespaced string-valued metadata
- **AND** the Markdown body remains byte-for-byte unchanged
- **AND** supporting files and unrelated standard metadata are preserved
- **AND** a second migration makes no changes

#### Scenario: Conflicting representations
- **WHEN** a skill declares different values for a legacy extension and its namespaced replacement
- **THEN** normalization and migration report the conflict
- **AND** migration does not overwrite either representation

#### Scenario: Batch migration preflight
- **WHEN** an unnamed migration selects multiple skills and any selected header is invalid or conflicts
- **THEN** the command reports the error before rewriting any selected header

### Requirement: Optional Native Skill Export
The CLI SHALL offer explicit `skill export --target agents` to project standard-valid canonical skills and support files into repository-local `.agents/skills/<name>/`. `.reffy/skills/` SHALL remain canonical. Export SHALL use complete copied directories, preserve resource-relative paths and executable permissions where applicable, and maintain versioned ownership records outside the artifact manifest.

#### Scenario: Explicit installation and repeat export
- **WHEN** a user exports standard-valid skills to the agents target
- **THEN** complete skill directories are installed with matching directory/header names and usable support-file references
- **AND** repeat export with unchanged sources makes no content changes
- **AND** canonical sources and manifest artifact entries remain authoritative and unchanged by export

#### Scenario: Destination conflict or unsafe resource
- **WHEN** export preflight encounters an untracked destination, locally modified tracked content, unexpected files, a symlink, or unsafe traversal
- **THEN** it reports the conflict and writes no destinations in that batch
- **AND** it preserves user-authored content

#### Scenario: Safe explicit refresh
- **WHEN** sources change or disappear and the user re-exports
- **THEN** previously exported, unmodified files are refreshed or removed according to current sources
- **AND** missing tracked destinations can be recreated
- **AND** ownership records reflect successful writes and permit retry after interrupted I/O

#### Scenario: Initialization and compatibility boundaries
- **WHEN** a user runs ordinary init without export
- **THEN** no native export is created or refreshed
- **AND** export of legacy nonstandard headers fails with migration guidance before any destination writes
- **AND** unknown export targets are rejected

### Requirement: Skill Conformance Coverage
The project SHALL exercise parsing, standard constraints, legacy migration, descriptor compatibility, and native export through regression and CLI integration coverage. CI SHALL validate freshly generated managed and custom skill fixtures with strict Reffy validation and an upstream reference validator pinned to an immutable revision, while keeping that validator out of production runtime dependencies.

#### Scenario: Generated output fails upstream conformance
- **WHEN** a generated managed or custom skill fixture violates the pinned reference validator's contract
- **THEN** CI fails and identifies the offending fixture
- **AND** local Reffy validation success alone cannot satisfy this gate

#### Scenario: Behavioral regressions
- **WHEN** test suites run
- **THEN** they exercise minimal/optional headers, multiline and quoted YAML, invalid types and lengths, legacy conflicts and migration preservation, discovery output, and safe/idempotent native export
- **AND** core CLI commands remain usable offline without the upstream Python validator installed

### Requirement: Skill Selection and Workflow Evaluation
Release verification SHALL include representative selection prompts, negative cases, and workflow checks for built-in skills, including remote and superseding-change intent. Evaluation inputs, expected selections, execution procedure, outcomes, and any unavailable native-client check SHALL be recorded in maintained project test/documentation resources.

#### Scenario: Description-driven evaluation
- **WHEN** built-in descriptions change
- **THEN** evaluation checks selection using names and descriptions without requiring Reffy trigger metadata
- **AND** includes unrelated prompts that should not select a skill and representative procedure outcomes

#### Scenario: Native discovery verification
- **WHEN** the native export feature is prepared for release
- **THEN** verification attempts discovery and loading through an available compatible client
- **AND** any unavailable client execution is recorded as a limitation rather than reported as a passed integration check
