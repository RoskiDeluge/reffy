import { promises as fs } from "node:fs";
import path from "node:path";

import { DEFAULT_PLANNING_RELATIVE_DIR, resolveCanonicalPlanningPath } from "./planning-paths.js";
import type { Artifact } from "./types.js";

interface StoreLike {
  repoRoot: string;
  listArtifacts(): Promise<Artifact[]>;
  getArtifactPath(artifact: Artifact): string;
  linkPlanningOutputs(artifactFilenames: string[], outputPaths: string[], changeId: string): Promise<{ linked: number }>;
}

export interface CreatePlanInput {
  changeId: string;
  title?: string;
  artifactFilters?: string[];
  includeAllArtifacts?: boolean;
  overwrite?: boolean;
}

export interface CreatePlanResult {
  change_id: string;
  change_dir: string;
  selected_artifacts: string[];
  written_files: string[];
  linked_artifacts: number;
}

interface ArtifactPlanningInput {
  filename: string;
  name: string;
  problem: string[];
  proposedFeatures: string[];
  openQuestions: string[];
  acceptanceCriteria: string[];
}

interface PlanningSignals {
  problems: string[];
  proposedFeatures: string[];
  openQuestions: string[];
  acceptanceCriteria: string[];
}

function normalizeKebab(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function deriveCapabilityId(changeId: string): string {
  return changeId.replace(/^(add|update|remove|refactor)-/, "") || changeId;
}

function deriveTitle(changeId: string): string {
  return changeId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function deriveRequirementTitle(title: string): string {
  return title.replace(/^Add\s+/i, "").replace(/^Update\s+/i, "").replace(/^Refactor\s+/i, "").trim() || title;
}

function pushUnique(list: string[], value: string): void {
  const next = value.trim().replace(/\s+/g, " ");
  if (!next) return;
  if (!list.includes(next)) list.push(next);
}

function collectSignals(artifactInputs: ArtifactPlanningInput[]): PlanningSignals {
  const signals: PlanningSignals = {
    problems: [],
    proposedFeatures: [],
    openQuestions: [],
    acceptanceCriteria: [],
  };

  for (const artifact of artifactInputs) {
    for (const item of artifact.problem) pushUnique(signals.problems, item);
    for (const item of artifact.proposedFeatures) pushUnique(signals.proposedFeatures, item);
    for (const item of artifact.openQuestions) pushUnique(signals.openQuestions, item);
    for (const item of artifact.acceptanceCriteria) pushUnique(signals.acceptanceCriteria, item);
  }

  return signals;
}

function lowerInitial(text: string): string {
  if (!text) return text;
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

function toShallStatement(value: string): string {
  const trimmed = value.trim().replace(/\.$/, "");
  if (!trimmed) {
    return "The system SHALL implement the approved behavior described by this change.";
  }

  if (/^the system shall\b/i.test(trimmed)) {
    return trimmed.replace(/^the system shall\b/i, "The system SHALL").replace(/\.$/, "") + ".";
  }

  return `The system SHALL ${lowerInitial(trimmed)}.`;
}

function buildWhyText(signals: PlanningSignals, artifactCount: number): string {
  if (signals.problems.length === 0) {
    return "This change is being scaffolded from indexed Reffy artifacts so the implementation plan stays connected to the ideation context captured in `.reffy/`.";
  }

  const summary = signals.problems.slice(0, 3).join(" ");
  if (artifactCount > 1) {
    return `${summary} This proposal synthesizes planning context from ${String(artifactCount)} related Reffy artifacts.`;
  }

  return summary;
}

function buildImpactText(capabilityId: string, signals: PlanningSignals): string {
  const codeAreas: string[] = [];
  for (const item of signals.proposedFeatures) {
    const lowered = item.toLowerCase();
    if (lowered.includes("proposal")) pushUnique(codeAreas, "planning scaffold generation");
    if (lowered.includes("task")) pushUnique(codeAreas, "task scaffold generation");
    if (lowered.includes("traceability") || lowered.includes("manifest")) pushUnique(codeAreas, "manifest traceability");
    if (lowered.includes("design")) pushUnique(codeAreas, "design scaffold generation");
  }

  const affectedCode = codeAreas.length > 0 ? codeAreas.join(", ") : "to be filled in during proposal refinement";
  return `## Impact
- Affected specs: \`${capabilityId}\`
- Affected code: ${affectedCode}`;
}

function normalizeHeading(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9 ]+/g, "");
}

function extractMarkdownSections(content: string): Record<string, string[]> {
  const sections: Record<string, string[]> = {};
  let current = "root";
  sections[current] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const heading = rawLine.match(/^#{1,6}\s+(.+)$/)?.[1];
    if (heading) {
      current = normalizeHeading(heading);
      sections[current] ??= [];
      continue;
    }

    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("- ") || line.startsWith("* ")) {
      sections[current].push(line.slice(2).trim());
    } else {
      sections[current].push(line);
    }
  }

  return sections;
}

async function loadArtifactPlanningInputs(store: StoreLike, artifacts: Artifact[]): Promise<ArtifactPlanningInput[]> {
  const inputs: ArtifactPlanningInput[] = [];

  for (const artifact of artifacts) {
    let content = "";
    try {
      content = await fs.readFile(store.getArtifactPath(artifact), "utf8");
    } catch {
      content = "";
    }

    const sections = extractMarkdownSections(content);
    inputs.push({
      filename: artifact.filename,
      name: artifact.name,
      problem: [...(sections["problem"] ?? []), ...(sections["why"] ?? [])],
      proposedFeatures: [...(sections["proposed feature"] ?? []), ...(sections["what changes"] ?? [])],
      openQuestions: [...(sections["open questions"] ?? []), ...(sections["questions"] ?? [])],
      acceptanceCriteria: [...(sections["acceptance criteria"] ?? []), ...(sections["success criteria"] ?? [])],
    });
  }

  return inputs;
}

function buildProposal(title: string, capabilityId: string, artifactInputs: ArtifactPlanningInput[]): string {
  const signals = collectSignals(artifactInputs);
  const references =
    artifactInputs.length === 0
      ? "No Reffy references used."
      : artifactInputs.map((artifact) => `- \`${artifact.filename}\` - planning input artifact`).join("\n");
  const changeBullets =
    signals.proposedFeatures.length > 0
      ? signals.proposedFeatures.map((item) => `- ${item}`).join("\n")
      : `- Create or update the \`${capabilityId}\` capability.\n- Generate initial proposal, tasks, and spec delta scaffolds from selected Reffy artifacts.\n- Preserve explicit traceability back to the source planning artifacts.`;

  return `# Change: ${title}

## Why
${buildWhyText(signals, artifactInputs.length)}

## What Changes
${changeBullets}

${buildImpactText(capabilityId, signals)}

## Reffy References
${references}
`;
}

function buildTasks(artifactInputs: ArtifactPlanningInput[]): string {
  const signals = collectSignals(artifactInputs);

  const implementation =
    signals.proposedFeatures.length > 0
      ? signals.proposedFeatures.map((item, index) => `- [ ] 1.${index + 1} ${item}`).join("\n")
      : `- [ ] 1.1 Review selected Reffy artifacts and confirm proposal scope.
- [ ] 1.2 Refine proposal details and technical design decisions.
- [ ] 1.3 Implement the scoped behavior changes.
- [ ] 1.4 Add or update tests for the changed behavior.`;
  const verification =
    signals.acceptanceCriteria.length > 0
      ? signals.acceptanceCriteria.map((item, index) => `- [ ] 2.${index + 1} Verify ${item}`).join("\n")
      : `- [ ] 2.1 Run the relevant automated checks.
- [ ] 2.2 Validate the change with \`reffy plan validate <change-id>\`.
- [ ] 2.3 Review the generated ReffySpec files for correctness.`;

  return `## 1. Implementation
${implementation}

## 2. Verification
${verification}
`;
}

function buildDesign(artifactInputs: ArtifactPlanningInput[]): string {
  const signals = collectSignals(artifactInputs);
  const refs =
    artifactInputs.length === 0 ? "- None yet." : artifactInputs.map((artifact) => `- ${artifact.filename}`).join("\n");
  const goalText =
    signals.proposedFeatures.length > 0
      ? signals.proposedFeatures.map((goal) => `  - ${goal}`).join("\n")
      : "  - Refine the implementation approach for this change.";
  const questionText =
    signals.openQuestions.length > 0 ? signals.openQuestions.map((question) => `- ${question}`).join("\n") : "- None yet.";
  const contextText =
    signals.problems.length > 0
      ? signals.problems.slice(0, 4).map((problem) => `- ${problem}`).join("\n")
      : "- Planning context will be refined during proposal review.";
  const decisionText =
    signals.proposedFeatures.length > 0
      ? signals.proposedFeatures.slice(0, 3).map((feature) => `- Decision: Prioritize ${lowerInitial(feature)}.\n  - Rationale: This came directly from the approved Reffy artifact set.`).join("\n")
      : "- Decision: Scope refinement pending proposal review.\n  - Rationale: This file is an initial scaffold.";
  return `## Context
This design scaffold was generated from Reffy artifacts to keep planning traceable to upstream ideation instead of treating the artifacts as detached brainstorming notes.

### Problem Summary
${contextText}

## Goals / Non-Goals
- Goals:
${goalText}
  - Preserve traceability to the selected Reffy artifacts.
- Non-Goals:
  - Finalize every implementation detail before proposal review.

## Decisions
${decisionText}

## Reffy Inputs
${refs}

## Open Questions
${questionText}
`;
}

function buildSpecDelta(requirementTitle: string, artifactInputs: ArtifactPlanningInput[]): string {
  const signals = collectSignals(artifactInputs);
  const requirementText = signals.proposedFeatures[0]?.trim();
  const scenarioWhen = signals.acceptanceCriteria[0]?.trim();
  return `## ADDED Requirements
### Requirement: ${requirementTitle}
${requirementText ? toShallStatement(requirementText) : "The system SHALL implement the approved behavior described by this change."}

#### Scenario: Planned change is delivered
- **WHEN** ${scenarioWhen ? scenarioWhen.replace(/\.$/, "") : "the implementation for this change is completed"}
- **THEN** the system behavior matches the approved proposal
- **AND** the updated behavior is covered by verification steps
`;
}

async function ensureEmptyChangeDir(changeDir: string, overwrite: boolean): Promise<void> {
  try {
    const existing = await fs.readdir(changeDir);
    if (existing.length > 0 && !overwrite) {
      throw new Error(`Change directory already exists and is not empty: ${changeDir}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function createPlanScaffold(store: StoreLike, input: CreatePlanInput): Promise<CreatePlanResult> {
  const artifacts = await store.listArtifacts();
  const requested = new Set((input.artifactFilters ?? []).map((entry) => entry.trim()).filter(Boolean));
  const selected =
    input.includeAllArtifacts || requested.size === 0
      ? artifacts
      : artifacts.filter((artifact) => requested.has(artifact.filename) || requested.has(artifact.id));

  if (artifacts.length > 0 && selected.length === 0) {
    throw new Error("No indexed artifacts matched the requested filters");
  }

  const changeId = normalizeKebab(input.changeId);
  if (!changeId) {
    throw new Error("change id must contain at least one alphanumeric character");
  }

  const title = input.title?.trim() || deriveTitle(changeId);
  const capabilityId = normalizeKebab(deriveCapabilityId(changeId));
  const artifactInputs = await loadArtifactPlanningInputs(store, selected);
  const changeDir = resolveCanonicalPlanningPath(store.repoRoot, "changes", changeId);
  const specDir = path.join(changeDir, "specs", capabilityId);
  await ensureEmptyChangeDir(changeDir, input.overwrite ?? false);
  await fs.mkdir(specDir, { recursive: true });

  const files = [
    {
      rel: path.join(DEFAULT_PLANNING_RELATIVE_DIR, "changes", changeId, "proposal.md"),
      content: buildProposal(title, capabilityId, artifactInputs),
    },
    {
      rel: path.join(DEFAULT_PLANNING_RELATIVE_DIR, "changes", changeId, "tasks.md"),
      content: buildTasks(artifactInputs),
    },
    {
      rel: path.join(DEFAULT_PLANNING_RELATIVE_DIR, "changes", changeId, "design.md"),
      content: buildDesign(artifactInputs),
    },
    {
      rel: path.join(DEFAULT_PLANNING_RELATIVE_DIR, "changes", changeId, "specs", capabilityId, "spec.md"),
      content: buildSpecDelta(deriveRequirementTitle(title), artifactInputs),
    },
  ];

  for (const file of files) {
    const abs = path.join(store.repoRoot, file.rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, file.content, "utf8");
  }

  const writtenFiles = files.map((file) => file.rel.split(path.sep).join("/"));
  const linkResult = await store.linkPlanningOutputs(
    selected.map((artifact) => artifact.filename),
    writtenFiles,
    changeId,
  );

  return {
    change_id: changeId,
    change_dir: changeDir,
    selected_artifacts: selected.map((artifact) => artifact.filename),
    written_files: writtenFiles,
    linked_artifacts: linkResult.linked,
  };
}
