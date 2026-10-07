# Seed-First Project Entry Point

## Core idea

A single `seed.md` should be a first-class starting point for a project in Reffy. It gives an evolving understanding a coherent home, from a rough idea to detailed requirements, diagrams, constraints, and acceptance criteria, without requiring an early commitment to a planning structure.

The guiding principle: **let understanding develop in one place, then introduce structure when it earns its keep.**

This is an exploratory feature direction. The entry point and interactions below describe possible behavior, with implementation choices still open.

## Why this matters

At the beginning of a project, users may know the problem they want to solve without knowing how to divide it into artifacts, specifications, or proposals. A seed gives them somewhere useful to start immediately. Markdown accommodates both incomplete thoughts and substantial detail, so the same file can grow as the user learns.

The transition to structured spec-driven development (SDD) should follow the project's needs. Sections may eventually need independent ownership, revision histories, or change tracking. Those needs create a reason to extract structure; document length or completion of a template alone does not.

## Possible user experience

1. **Start with a seed.** Offer a visible “Create or import seed.md” entry point. A user can begin with a sentence, paste existing notes, or bring an existing Markdown document. Imported content should retain its organization.
2. **Offer optional guidance.** Suggest prompts that help the user express what they already know. Users can skip, rename, remove, or add sections freely.
3. **Support gradual refinement.** Let users expand and revise the seed as questions become clearer, including requirements, diagrams, and acceptance criteria when useful. Saving or revising the seed should not require creating formal planning files.
4. **Extract structure deliberately.** When useful, help the user select sections and turn them into focused artifacts or planning inputs for specs and proposals. Let the user review the destination and extracted content before applying the extraction.
5. **Preserve intent and lineage.** Keep the seed as a durable reference. Link resulting documents back to their source in the seed and make those documents discoverable from it.

## Optional starting prompts

- **Purpose:** What are you trying to make possible, and why?
- **Users:** Who is this for, and what do they need?
- **Constraints:** What boundaries or hard requirements are already known?
- **Open questions:** What remains uncertain or needs exploration?

These are invitations to write, not required fields or a completeness checklist. A short paragraph is a valid seed, and a detailed existing document is equally valid.

## Extraction and continuity

Extraction should preserve the reasoning and context behind a section, including unresolved questions. A plausible interaction would leave a short summary and a link in the seed, while the extracted document gains room to evolve independently. This is a candidate approach, not a settled synchronization model.

Once a section becomes structured planning material, readers should be able to distinguish its original intent from the current specification or proposed change. The seed remains useful as project context without requiring users to maintain duplicate authoritative requirements.

## Open design questions

- Where should `seed.md` live, and how should Reffy discover and index it?
- Should this entry point appear during initialization, as a dedicated command, or in another user-facing surface?
- How should import handle an existing seed or relative links and assets in the source document?
- When extracting a section, should Reffy retain the original text, replace it with a summary and link, or offer a choice?
- How should source links survive heading changes, and when should lineage capture the source revision?

## Signs the experience works

A user can start with incomplete notes, return to refine the same file, and introduce planning documents only when they become useful. After extraction, readers can trace a document back to the seed's intent and understand where its current requirements are maintained.
