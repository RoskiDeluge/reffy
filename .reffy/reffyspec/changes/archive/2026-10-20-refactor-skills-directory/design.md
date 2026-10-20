# Design: Standard skill files with compatible Reffy tooling

## Context and scope
The audit reproduces semantic YAML loss, acceptance of overlong fields, rejection of minimal standard headers, custom top-level fields in every generated skill, and incomplete default discovery output. No active changes conflict with this proposal. `.reffy/reffyspec/specs/skills-directory/spec.md` currently requires several of these behaviors, so its requirements must change along with the implementation.

The boundary remains file-based: Reffy generates and inspects instructions; it does not execute skill bodies. All high/medium audit items are included. Extracting embedded definitions into packaged source assets, building a generic agent runtime, and additional assistant-specific export adapters are outside this change.

## Standard header and internal descriptor
Use a maintained YAML library for parsing and serialization. Parse frontmatter into a typed header plus unchanged Markdown body. Preserve `name`, `description`, `license`, `compatibility`, `metadata`, and `allowed-tools`. Reject malformed YAML, duplicate keys, non-mapping headers, and incorrect types with field/path diagnostics. Do not repair malformed input silently or coerce YAML numbers/booleans into strings. File listing/loading reports malformed records without concealing valid siblings; validation still fails for each invalid record.

Generated files use only standard top-level fields. Built-ins declare the Reffy CLI and initialized-workspace requirement in `compatibility`. Reffy-specific values use these string-valued keys:

```yaml
metadata:
  reffy-managed: "true"
  reffy-commands: '["reffy reindex", "reffy validate"]'
  reffy-triggers: '["capture idea", "add note"]'
```

`reffy-triggers` is optional supplementary metadata. Neither it nor the existing normalized `triggers` descriptor array is required for selection or validation. Decode command/trigger strings as JSON arrays of strings and the managed string as `true` or `false`; absent values normalize to empty arrays and false. Diagnose malformed Reffy extension encodings separately from standard field errors. Do not treat declared commands or `allowed-tools` as authorization to execute anything.

Keep existing CLI descriptor keys (`name`, `description`, `triggers`, `commands`, `managed`, `path`) and add the standard optional fields when supplied. `path` stays repository-relative for compatibility; add an absolute `location` to remove ambiguity when using `--repo`. `list` excludes bodies, and `show --output json` adds the selected body. Preserve the existing JSON envelope. Record diagnostics in a structured additive field and write text diagnostics to stderr.

## Validation and compatibility
Default `skill validate` and `reffy validate` enforce syntax, required fields, naming, lengths, optional-field types, duplicate skill names, and Reffy extension encodings. Required strings are nonempty. Names are 1–64 Unicode code points, lowercase alphanumeric characters with single internal hyphens, and match the containing directory; test Unicode handling against the pinned reference validator. Descriptions are 1–1,024 code points. Compatibility, if supplied, is 1–500 code points. License and allowed-tools are strings; metadata is a mapping from string keys to string values. Unknown top-level fields fail validation except the three explicitly supported legacy Reffy extensions in compatibility mode.

Recognized legacy top-level `triggers` and `commands` arrays and `managed` boolean remain readable. Missing or empty triggers are valid. Legacy fields emit deprecation warnings in default validation/list/show and normalize to the same descriptors used by new files. All other standard constraints still apply. `skill validate --standard` rejects legacy top-level fields, enabling an unambiguous conformance gate. Default output must not describe a legacy-header success as standard conformance.

If a legacy extension and its namespaced equivalent coexist, accept matching semantic values with a warning and reject conflicting values. Neither precedence nor silent coercion should hide a conflict. Command-drift checks consume normalized commands in both formats and retain the existing known-command behavior.

`skill migrate [<name>]` explicitly rewrites legacy custom headers to namespaced metadata. With no name it selects all canonical skills. Preflight all selected headers and extension conflicts before writing. Preserve the Markdown body byte-for-byte, standard optional fields, unrelated valid metadata, and supporting files. Refuse unknown fields rather than discarding data. Repeated migration of standard files is a no-op. Report changed/skipped records in text/JSON. Initialization refreshes the known CLI-owned built-ins to standard output, but does not migrate arbitrary user-owned files. A built-in-name collision with a valid user-owned file fails with guidance rather than silently overwriting it.

## Selection and guidance
Rewrite every built-in description to state its purpose and natural-language activation conditions. Include the audit's remote/publication/Paseo vocabulary and pivot/deprecation/wind-down/reversal vocabulary in the corresponding descriptions. Optional triggers may supplement descriptions but cannot carry essential activation intent alone.

Text `skill list` includes each name, description, managed state, and SKILL.md path. JSON provides equivalent metadata and location without the body. Managed AGENTS guidance instructs agents to enumerate skills, select by description, read the selected file, and then follow it. JSON discovery is documented for programmatic consumers. Keep remote intent routing and the distinction between loading instructions and authorizing remote actions. Explain that supporting paths are resolved relative to the selected skill directory. Update README examples, migration guidance, and new command usage together.

## Opt-in native discovery export
Expose `reffy skill export --target agents [--repo PATH] [--output text|json]`. The initial target adapter maps directly to `<repo>/.agents/skills/<name>/SKILL.md`; the containing directory always matches the header name. Keep target mapping separate from copy logic so further adapters can be added later. Reject unknown targets; do not accept arbitrary output paths in this change.

Export all valid canonical skills and their support files as complete copies, preserving relative paths and executable permissions where applicable. Require standard-valid headers; tell users to migrate legacy custom skills before export. Copies avoid assuming symlink support or recursive native discovery of an extra `reffy/` namespace directory. The canonical source remains `.reffy/skills/`; Reffy discovery does not import exported copies or index them as artifacts.

Store versioned export ownership state in `.reffy/skill-exports.json`, separate from the artifact manifest, recording target-relative skill paths and file content hashes. Before mutation, validate all sources, containment, existing destinations, and ownership. Refuse existing untracked destination directories, locally edited tracked files, unexpected files, symlinks, or unsafe traversal. A missing tracked destination can be recreated. Preflight conflicts across the whole batch so a known conflict causes no destination writes. No force-overwrite mode is included.

Repeated export is idempotent. Explicit re-export updates previously exported, unmodified content and removes previously tracked, unmodified files or skills that disappeared from the source. Never delete unrelated files. Hashes alone do not confer ownership without a matching export-state record. Use staged writes and atomic per-file replacement; update ownership records only for successful writes and report I/O failures so retries can reconcile interrupted work. Do not promise a cross-directory filesystem transaction.

Plain `init` creates/refreshes canonical sources only. After an update users run export again; the CLI/docs make this refresh model explicit. Supporting resource references remain relative to the exported skill root. Reffy's own `.reffy/` workspace paths in procedure steps continue to identify repository context, not the skill directory. No network operation or skill execution is introduced.

## Verification and rollout
Add meaningful regression fixtures for minimal headers, folded/literal descriptions, quoting and commas, optional fields, malformed/duplicate-key YAML, Unicode and length boundaries, unknown fields, legacy conflicts, and metadata encodings. Exercise validation in default and strict modes, migration idempotence/body preservation, ownership collisions, and list/show output in both formats.

CI generates fresh managed skills and a completed custom-skill fixture in temporary workspaces and validates them with strict Reffy validation and an upstream `skills-ref` validator pinned to an immutable revision. It is a test dependency only; core commands remain offline and Node-based. Record the pin and any intentional interpretation differences. A failed conformance check fails CI.

Add export integration coverage for resource paths and executable files, repeat exports, source updates/removals, missing destinations, collisions, local edits, unsafe links, and interrupted-write retry behavior. Do not use implementation-mirroring assertions as a substitute for these observable behaviors.

Maintain a small set of representative selection prompts and expected skills, including false positives, remote intent, and superseding-change intent. Document a repeatable agent evaluation procedure and record selection and workflow outcomes before release. Header conformance alone does not demonstrate selection quality or native-client integration. Perform an actual discovery/loading smoke check in an available client; if unavailable, record the limitation rather than claiming it ran.

Ship compatibility reading, standard generation, and explicit migration together. Refresh this repository's built-ins and managed guidance through the updated generator during implementation, then run `pnpm build`, `pnpm check`, `pnpm test`, strict conformance checks, and planning validation. Keep archived history unchanged. Native installation remains opt-in throughout.

## Risks and tradeoffs
String-encoded arrays are less readable than native YAML lists but satisfy the standard metadata contract while retaining Reffy's normalized descriptors. Compatibility mode delays removal of legacy fields; strict mode and warnings prevent it from being confused with standard conformance. Exported copies require explicit refresh, in exchange for broad filesystem compatibility and clear ownership. A later release may remove legacy reading or add export adapters through a separate change.

## Sources
- [Agent Skills specification](https://agentskills.io/specification).
- [Reference validator](https://github.com/agentskills/agentskills/blob/main/skills-ref/src/skills_ref/validator.py).
- [Client implementation guidance](https://agentskills.io/client-implementation/adding-skills-support).
- [Description guidance](https://agentskills.io/skill-creation/optimizing-descriptions).
- Local evidence and original verification are recorded in `agent-skills-standard-audit.md`; the native-discovery direction comes from `assistant-native-skill-installation-paths.md`.

## Implementation verification (2026-10-19)
- Implemented standard YAML parsing/generation, compatible normalization, migration, description-first discovery, and opt-in agents export with ownership/recovery state.
- `pnpm build` and `pnpm check` passed. `pnpm test` passed all 179 tests and the configured coverage gate (88.56% statements/lines in the configured manifest/storage/summarization scope).
- Strict validation passed for all seven regenerated checked-in skills. The pinned upstream validator and Reffy strict validation passed 11 generated/Unicode fixtures, including a completed custom scaffold.
- `node scripts/evaluate-skill-workflows.mjs` passed in a temporary repository. Selection prompts, observed manual results, and workflow outcomes are recorded in `test/fixtures/skill-evaluation.md`.
- Native automatic discovery/activation in a separate client session remains unverified; the evaluation notes explicitly record that limitation. Export layout, file/resource loading, ownership, refresh, and recovery are covered.
- Manifest validation and ReffySpec planning validation passed. The change remains active for review; canonical spec/archive history has not been rewritten by this implementation.
