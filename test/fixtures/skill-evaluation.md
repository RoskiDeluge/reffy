# Built-in skill evaluation

Run `pnpm build`, then `node scripts/evaluate-skill-workflows.mjs` for local procedure smoke tests. Run `pnpm test:skill-conformance` with the validator from `scripts/skills-ref-requirements.txt` installed for the independent header check. Automated regression cases live in `skills-standard.test.ts`, `skills-cli.test.ts`, and the existing CLI integration suite.

## Description-only selection cases

Repeat this check after changing descriptions: expose only each skill's `name` and `description` from `reffy skill list --output json`, hide triggers and bodies, and ask the evaluating agent to select the primary skill or none for each prompt. Compare selections with the expected column. `inspect-specs` may additionally be used as a prerequisite when implementing or drafting a change.

The observed column records this implementation session's manual agent review on 2026-10-19. It is a catalog review by the implementing assistant, not an independent model benchmark or a statistical accuracy estimate.

| Prompt | Expected primary skill | Observed primary selection |
| --- | --- | --- |
| Save this idea as a research note before we plan anything. | create-artifact | create-artifact |
| Reindex the new exploratory notes into Reffy. | create-artifact | create-artifact |
| Turn these captured artifacts into a proposal and implementation tasks. | create-change | create-change |
| Archive the completed, verified change and merge its spec delta. | archive-change | archive-change |
| We are pivoting away from the earlier decision. Write a superseding change. | supersede-change | supersede-change |
| Deprecate and wind down the existing approach while preserving its history. | supersede-change | supersede-change |
| Show the current requirements and scenarios for this capability. | inspect-specs | inspect-specs |
| Doctor reports a broken Reffy workspace. Help diagnose the setup. | diagnose | diagnose |
| Publish our shared references to the Paseo remote workspace. | sync-remote | sync-remote |
| Inspect remote synchronization status without publishing. | sync-remote | sync-remote |
| Translate the word hello into Spanish. | none | none |
| Fix a spelling typo in this CSS comment. | none | none |

## Procedure execution results

The workflow smoke script passed on 2026-10-19 in an isolated temporary repository:

- Initialization exposed seven loadable skills with step instructions.
- Artifact capture, reindexing, and validation registered the expected note.
- Proposal generation from that note passed planning validation.
- Completing and archiving the fixture merged its requirement into canonical specs; list/show returned it.
- A superseding proposal recorded the original change and applied a MODIFIED delta; validation and archive preserved the revised canonical requirement.
- Doctor passed required workspace checks; optional tool availability did not block the flow.
- Remote status failed fast with an unconfigured target. No real remote publication was attempted.
- Explicit export installed seven complete skill directories; file loading matched canonical content and repeat export made no changes.

The pinned upstream validator (`69ef37e9424c0a7ea9dd2293b559e43ec8176379`) passed all seven generated built-ins, one custom scaffold, and three Unicode-name fixtures (`données`, `分析`, `𐐨-数据`). Reffy strict validation also passed these fixtures. The upstream oracle does not enforce every metadata/type constraint; local validation additionally enforces the specification's string-valued metadata, nonempty compatibility, duplicate-key and unknown-tag rejection. Names compare after NFKC normalization; original source strings are preserved in descriptors.

## Native client limitation and release check

Export layout, resource loading, ownership, refresh, and retry behavior were tested. A native assistant's automatic discovery and activation were not verified: this session does not provide a separate connected native-client session for that smoke test. Presence of a client executable alone is not evidence of successful discovery.

Before claiming native-client integration is verified, export in a disposable initialized repository, open a fresh supported client session there, confirm all seven skills appear through native discovery, and ask it to load a named skill and any referenced support file. Record the client/version, selected skill, and observed loading result here. Keep this limitation explicit until that check runs; do not substitute direct file reads for native activation.
