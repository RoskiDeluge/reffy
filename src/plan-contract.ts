const DELTA_SECTION_PATTERN = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/;
const REQUIREMENT_PATTERN = /^###\s+Requirement:\s+(.+)$/;
const SCENARIO_PATTERN = /^####\s+Scenario:\s+(.+)$/;
const BAD_SCENARIO_PATTERNS = [/^###\s+Scenario:/, /^- \*\*Scenario:/, /^\*\*Scenario\*\*:/];
const RENAME_FROM_PATTERN = /^\s*-?\s*FROM:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/;
const RENAME_TO_PATTERN = /^\s*-?\s*TO:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/;
const REQUIREMENTS_HEADING = "## Requirements";

export type DeltaSectionType = "ADDED" | "MODIFIED" | "REMOVED" | "RENAMED";

export interface RequirementBlock {
  title: string;
  content: string;
}

export interface RenameOperation {
  from: string;
  to: string;
}

export interface ParsedDelta {
  added: RequirementBlock[];
  modified: RequirementBlock[];
  removed: RequirementBlock[];
  renamed: RenameOperation[];
}

export interface DeltaParseResult {
  delta: ParsedDelta;
  errors: string[];
}

export interface DeltaApplyResult {
  content?: string;
  errors: string[];
}

interface CurrentSpecParts {
  prefix: string;
  blocks: RequirementBlock[];
  suffix: string;
}

export function normalizeRequirementName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function emptyDelta(): ParsedDelta {
  return { added: [], modified: [], removed: [], renamed: [] };
}

export function parseDeltaSpec(content: string, relPath: string): DeltaParseResult {
  const delta = emptyDelta();
  const errors: string[] = [];
  const lines = content.split(/\r?\n/);
  const seenSections = new Set<DeltaSectionType>();
  let currentSection: DeltaSectionType | null = null;
  let currentRequirement: RequirementBlock | null = null;
  let currentRequirementLines: string[] = [];
  let currentScenarioCount = 0;
  let renameFrom: string | null = null;

  const flushRequirement = (): void => {
    if (!currentRequirement || !currentSection || currentSection === "RENAMED") return;
    currentRequirement.content = currentRequirementLines.join("\n").trimEnd();
    if (currentScenarioCount === 0) {
      errors.push(`${relPath}: requirement "${currentRequirement.title}" must include at least one scenario`);
    }
    if (currentSection === "ADDED") delta.added.push(currentRequirement);
    if (currentSection === "MODIFIED") delta.modified.push(currentRequirement);
    if (currentSection === "REMOVED") delta.removed.push(currentRequirement);
    currentRequirement = null;
    currentRequirementLines = [];
    currentScenarioCount = 0;
  };

  const flushIncompleteRename = (): void => {
    if (!renameFrom) return;
    errors.push(
      `${relPath}: RENAMED entry for "${renameFrom}" is missing a paired TO line; use FROM/TO requirement headings`,
    );
    renameFrom = null;
  };

  for (const line of lines) {
    const sectionMatch = line.match(DELTA_SECTION_PATTERN);
    if (sectionMatch) {
      flushRequirement();
      flushIncompleteRename();
      currentSection = sectionMatch[1] as DeltaSectionType;
      seenSections.add(currentSection);
      continue;
    }

    const requirementMatch = line.match(REQUIREMENT_PATTERN);
    if (requirementMatch) {
      flushRequirement();
      const title = requirementMatch[1]?.trim() ?? "unknown";
      if (!currentSection || currentSection === "RENAMED") {
        errors.push(`${relPath}: requirement "${title}" must appear in an ADDED, MODIFIED, or REMOVED section`);
        continue;
      }
      currentRequirement = { title, content: "" };
      currentRequirementLines = [line];
      currentScenarioCount = 0;
      continue;
    }

    if (currentSection === "RENAMED") {
      const fromMatch = line.match(RENAME_FROM_PATTERN);
      if (fromMatch) {
        flushIncompleteRename();
        renameFrom = fromMatch[1]?.trim() ?? "";
        continue;
      }
      const toMatch = line.match(RENAME_TO_PATTERN);
      if (toMatch) {
        const to = toMatch[1]?.trim() ?? "";
        if (!renameFrom) {
          errors.push(`${relPath}: RENAMED TO "${to}" is missing a preceding FROM line`);
        } else {
          delta.renamed.push({ from: renameFrom, to });
          renameFrom = null;
        }
        continue;
      }
      if (line.trim().length > 0) {
        errors.push(`${relPath}: invalid RENAMED entry; use paired FROM/TO requirement headings`);
      }
      continue;
    }

    if (currentRequirement) {
      currentRequirementLines.push(line);
      if (SCENARIO_PATTERN.test(line)) currentScenarioCount += 1;
      if (BAD_SCENARIO_PATTERNS.some((pattern) => pattern.test(line))) {
        errors.push(`${relPath}: scenarios must use "#### Scenario:" headings`);
      }
    }
  }

  flushRequirement();
  flushIncompleteRename();

  if (seenSections.size === 0) {
    errors.push(`${relPath}: must include at least one "## ADDED|MODIFIED|REMOVED|RENAMED Requirements" section`);
  }

  for (const section of seenSections) {
    const count =
      section === "ADDED"
        ? delta.added.length
        : section === "MODIFIED"
          ? delta.modified.length
          : section === "REMOVED"
            ? delta.removed.length
            : delta.renamed.length;
    if (count === 0) {
      const expected = section === "RENAMED" ? "paired FROM/TO entries" : "at least one requirement";
      errors.push(`${relPath}: ${section} Requirements must include ${expected}`);
    }
  }

  validateDeltaConflicts(delta, relPath, errors);
  return { delta, errors };
}

function collectDuplicateNames(
  blocks: RequirementBlock[],
  section: DeltaSectionType,
  relPath: string,
  errors: string[],
): Set<string> {
  const names = new Set<string>();
  for (const block of blocks) {
    const normalized = normalizeRequirementName(block.title);
    if (names.has(normalized)) {
      errors.push(`${relPath}: duplicate ${section} requirement "${block.title}"`);
    }
    names.add(normalized);
  }
  return names;
}

function validateDeltaConflicts(delta: ParsedDelta, relPath: string, errors: string[]): void {
  const added = collectDuplicateNames(delta.added, "ADDED", relPath, errors);
  const modified = collectDuplicateNames(delta.modified, "MODIFIED", relPath, errors);
  const removed = collectDuplicateNames(delta.removed, "REMOVED", relPath, errors);
  const renamedFrom = new Set<string>();
  const renamedTo = new Set<string>();
  const renameNames = new Set<string>();

  for (const rename of delta.renamed) {
    const from = normalizeRequirementName(rename.from);
    const to = normalizeRequirementName(rename.to);
    if (from === to) errors.push(`${relPath}: RENAMED source and destination are the same: "${rename.from}"`);
    if (renamedFrom.has(from)) errors.push(`${relPath}: duplicate RENAMED FROM requirement "${rename.from}"`);
    if (renamedTo.has(to)) errors.push(`${relPath}: duplicate RENAMED TO requirement "${rename.to}"`);
    if (renameNames.has(from) || renameNames.has(to)) {
      errors.push(`${relPath}: conflicting RENAMED operation involving "${rename.from}" and "${rename.to}"`);
    }
    renamedFrom.add(from);
    renamedTo.add(to);
    renameNames.add(from);
    renameNames.add(to);
  }

  const conflict = (name: string, first: string, second: string): void => {
    errors.push(`${relPath}: requirement "${name}" appears in incompatible ${first} and ${second} operations`);
  };

  for (const block of delta.added) {
    const name = normalizeRequirementName(block.title);
    if (modified.has(name)) conflict(block.title, "ADDED", "MODIFIED");
    if (removed.has(name)) conflict(block.title, "ADDED", "REMOVED");
    if (renamedTo.has(name)) conflict(block.title, "ADDED", "RENAMED TO");
  }
  for (const block of delta.modified) {
    const name = normalizeRequirementName(block.title);
    if (removed.has(name)) conflict(block.title, "MODIFIED", "REMOVED");
    if (renamedFrom.has(name)) {
      errors.push(
        `${relPath}: MODIFIED must use the RENAMED destination heading instead of source "${block.title}"`,
      );
    }
  }
  for (const block of delta.removed) {
    const name = normalizeRequirementName(block.title);
    if (renamedFrom.has(name) || renamedTo.has(name)) conflict(block.title, "REMOVED", "RENAMED");
  }
}

function parseCurrentSpec(content: string, relPath: string): { parts?: CurrentSpecParts; errors: string[] } {
  const lines = content.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === REQUIREMENTS_HEADING);
  if (headingIndex < 0) {
    return { errors: [`${relPath}: current spec is missing a "## Requirements" section`] };
  }

  let endIndex = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index] ?? "")) {
      endIndex = index;
      break;
    }
  }

  const bodyLines = lines.slice(headingIndex + 1, endIndex);
  const blocks: RequirementBlock[] = [];
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  const flush = (): void => {
    if (!currentTitle) return;
    blocks.push({ title: currentTitle, content: currentLines.join("\n").trimEnd() });
    currentTitle = null;
    currentLines = [];
  };

  for (const line of bodyLines) {
    const match = line.match(REQUIREMENT_PATTERN);
    if (match) {
      flush();
      currentTitle = match[1]?.trim() ?? "unknown";
      currentLines = [line];
      continue;
    }
    if (currentTitle) currentLines.push(line);
  }
  flush();

  const seen = new Set<string>();
  const duplicateErrors: string[] = [];
  for (const block of blocks) {
    const normalized = normalizeRequirementName(block.title);
    if (seen.has(normalized)) {
      duplicateErrors.push(`${relPath}: current spec contains duplicate requirement "${block.title}"`);
    }
    seen.add(normalized);
  }
  if (duplicateErrors.length > 0) return { errors: duplicateErrors };

  return {
    parts: {
      prefix: lines.slice(0, headingIndex + 1).join("\n"),
      blocks,
      suffix: lines.slice(endIndex).join("\n").trim(),
    },
    errors: [],
  };
}

function buildNewCurrentSpec(capability: string, changeId: string, blocks: RequirementBlock[]): string {
  return [
    `# ${capability} Specification`,
    "",
    "## Purpose",
    `TBD - created by archiving change ${changeId}. Update Purpose after archive.`,
    "",
    REQUIREMENTS_HEADING,
    ...blocks.flatMap((block) => ["", block.content]),
    "",
  ].join("\n");
}

function renderCurrentSpec(parts: CurrentSpecParts): string {
  const rendered = [parts.prefix, ...parts.blocks.flatMap((block) => ["", block.content])];
  if (parts.suffix) rendered.push("", parts.suffix);
  rendered.push("");
  return rendered.join("\n");
}

export function applyDeltaToCurrentSpec(input: {
  capability: string;
  changeId: string;
  delta: ParsedDelta;
  currentContent?: string;
  currentRelPath: string;
}): DeltaApplyResult {
  const { capability, changeId, delta, currentContent, currentRelPath } = input;
  const errors: string[] = [];

  if (currentContent === undefined) {
    for (const block of delta.modified) {
      errors.push(`${currentRelPath}: modified requirement "${block.title}" requires an existing current spec`);
    }
    for (const block of delta.removed) {
      errors.push(`${currentRelPath}: removed requirement "${block.title}" requires an existing current spec`);
    }
    for (const rename of delta.renamed) {
      errors.push(`${currentRelPath}: renamed source "${rename.from}" requires an existing current spec`);
    }
    if (errors.length > 0) return { errors };
    return { content: buildNewCurrentSpec(capability, changeId, delta.added), errors };
  }

  const parsedCurrent = parseCurrentSpec(currentContent, currentRelPath);
  if (!parsedCurrent.parts) return { errors: parsedCurrent.errors };
  const parts = parsedCurrent.parts;
  const findIndex = (title: string): number =>
    parts.blocks.findIndex((block) => normalizeRequirementName(block.title) === normalizeRequirementName(title));

  for (const rename of delta.renamed) {
    const sourceIndex = findIndex(rename.from);
    if (sourceIndex < 0) {
      errors.push(`${currentRelPath}: renamed source requirement "${rename.from}" was not found`);
      continue;
    }
    if (findIndex(rename.to) >= 0) {
      errors.push(`${currentRelPath}: renamed destination requirement "${rename.to}" already exists`);
      continue;
    }
    const source = parts.blocks[sourceIndex];
    const sourceLines = source.content.split("\n");
    sourceLines[0] = `### Requirement: ${rename.to}`;
    parts.blocks[sourceIndex] = { title: rename.to, content: sourceLines.join("\n") };
  }

  for (const block of delta.removed) {
    const index = findIndex(block.title);
    if (index < 0) {
      errors.push(`${currentRelPath}: removed requirement "${block.title}" was not found`);
      continue;
    }
    parts.blocks.splice(index, 1);
  }

  for (const block of delta.modified) {
    const index = findIndex(block.title);
    if (index < 0) {
      errors.push(`${currentRelPath}: modified requirement "${block.title}" was not found`);
      continue;
    }
    parts.blocks[index] = block;
  }

  for (const block of delta.added) {
    if (findIndex(block.title) >= 0) {
      errors.push(`${currentRelPath}: added requirement "${block.title}" already exists`);
      continue;
    }
    parts.blocks.push(block);
  }

  return errors.length > 0 ? { errors } : { content: renderCurrentSpec(parts), errors };
}
