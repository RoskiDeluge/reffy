import { promises as fs } from "node:fs";
import path from "node:path";

import { DEFAULT_PLANNING_DIRNAME } from "./planning-paths.js";
import { validatePlanningChange } from "./plan-runtime.js";
import { ReferencesStore } from "./storage.js";

const DELTA_SECTION_PATTERN = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/;
const REQUIREMENT_PATTERN = /^###\s+Requirement:\s+(.+)$/;
const REQUIREMENTS_HEADING = "## Requirements";

export interface PlanArchiveResult {
  change_id: string;
  archive_dir: string;
  archived_files: string[];
  updated_specs: string[];
  linked_artifacts: number;
}

interface RequirementBlock {
  title: string;
  content: string;
}

function archiveDatePrefix(): string {
  return new Date().toISOString().slice(0, 10);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function parseAddedRequirements(content: string, relPath: string): RequirementBlock[] {
  const lines = content.split(/\r?\n/);
  const sectionTypes = new Set<string>();
  const blocks: RequirementBlock[] = [];
  let inAddedSection = false;
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  const flush = (): void => {
    if (!currentTitle) return;
    blocks.push({
      title: currentTitle,
      content: currentLines.join("\n").trimEnd(),
    });
    currentTitle = null;
    currentLines = [];
  };

  for (const line of lines) {
    const sectionMatch = line.match(DELTA_SECTION_PATTERN);
    if (sectionMatch) {
      flush();
      const sectionType = sectionMatch[1] ?? "";
      sectionTypes.add(sectionType);
      inAddedSection = sectionType === "ADDED";
      continue;
    }

    const requirementMatch = line.match(REQUIREMENT_PATTERN);
    if (requirementMatch) {
      flush();
      currentTitle = requirementMatch[1]?.trim() ?? "unknown";
      currentLines = [line];
      continue;
    }

    if (currentTitle) {
      currentLines.push(line);
    }
  }

  flush();

  const unsupported = Array.from(sectionTypes).filter((sectionType) => sectionType !== "ADDED");
  if (unsupported.length > 0) {
    throw new Error(`${relPath}: unsupported delta sections for archive: ${unsupported.join(", ")}`);
  }
  if (!inAddedSection && sectionTypes.size === 0) {
    throw new Error(`${relPath}: no supported archiveable requirements found`);
  }
  if (blocks.length === 0) {
    throw new Error(`${relPath}: no ADDED requirements found to archive`);
  }

  return blocks;
}

function buildNewCurrentSpec(capability: string, changeId: string, blocks: RequirementBlock[]): string {
  return [
    `# ${capability} Specification`,
    "",
    "## Purpose",
    `TBD - created by archiving change ${changeId}. Update Purpose after archive.`,
    "",
    REQUIREMENTS_HEADING,
    ...blocks.map((block) => block.content),
    "",
  ].join("\n");
}

function appendRequirementsToCurrentSpec(existing: string, blocks: RequirementBlock[], relPath: string): string {
  if (!existing.includes(REQUIREMENTS_HEADING)) {
    throw new Error(`${relPath}: current spec is missing a "## Requirements" section`);
  }

  for (const block of blocks) {
    const escaped = block.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const duplicatePattern = new RegExp(`^###\\s+Requirement:\\s+${escaped}\\s*$`, "m");
    if (duplicatePattern.test(existing)) {
      throw new Error(`${relPath}: current spec already contains requirement "${block.title}"`);
    }
  }

  return `${existing.trimEnd()}\n\n${blocks.map((block) => block.content).join("\n\n")}\n`;
}

async function buildSpecUpdates(repoRoot: string, changeId: string, changeDir: string): Promise<Map<string, string>> {
  const specsRoot = path.join(changeDir, "specs");
  const entries = await fs.readdir(specsRoot, { withFileTypes: true }).catch(() => []);
  const updates = new Map<string, string>();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const capability = entry.name;
    const deltaPath = path.join(specsRoot, capability, "spec.md");
    if (!(await pathExists(deltaPath))) continue;

    const deltaContent = await fs.readFile(deltaPath, "utf8");
    const relDeltaPath = path.relative(repoRoot, deltaPath).split(path.sep).join("/");
    const blocks = parseAddedRequirements(deltaContent, relDeltaPath);
    const currentSpecPath = path.join(repoRoot, DEFAULT_PLANNING_DIRNAME, "specs", capability, "spec.md");

    const nextContent = (await pathExists(currentSpecPath))
      ? appendRequirementsToCurrentSpec(
          await fs.readFile(currentSpecPath, "utf8"),
          blocks,
          path.relative(repoRoot, currentSpecPath).split(path.sep).join("/"),
        )
      : buildNewCurrentSpec(capability, changeId, blocks);

    updates.set(currentSpecPath, nextContent);
  }

  return updates;
}

export async function archivePlanningChange(repoRoot: string, changeId: string): Promise<PlanArchiveResult> {
  const validation = await validatePlanningChange(repoRoot, changeId);
  if (!validation.ok) {
    throw new Error(`cannot archive invalid change "${changeId}": ${validation.errors.join("; ")}`);
  }

  const changeDir = path.join(repoRoot, DEFAULT_PLANNING_DIRNAME, "changes", changeId);
  if (!(await pathExists(changeDir))) {
    throw new Error(`change not found: ${changeId}`);
  }

  const archiveDir = path.join(repoRoot, DEFAULT_PLANNING_DIRNAME, "changes", "archive", `${archiveDatePrefix()}-${changeId}`);
  if (await pathExists(archiveDir)) {
    throw new Error(`archive destination already exists: ${path.relative(repoRoot, archiveDir).split(path.sep).join("/")}`);
  }

  const specUpdates = await buildSpecUpdates(repoRoot, changeId, changeDir);
  const activeFiles = await listFilesRecursive(changeDir);
  const pathMap = Object.fromEntries(
    activeFiles.map((filePath) => {
      const relCurrent = path.relative(repoRoot, filePath).split(path.sep).join("/");
      const archivedPath = path.join(archiveDir, path.relative(changeDir, filePath));
      const relArchived = path.relative(repoRoot, archivedPath).split(path.sep).join("/");
      return [relCurrent, relArchived];
    }),
  );

  for (const [specPath, content] of specUpdates) {
    await fs.mkdir(path.dirname(specPath), { recursive: true });
    await fs.writeFile(specPath, content, "utf8");
  }

  await fs.mkdir(path.dirname(archiveDir), { recursive: true });
  await fs.rename(changeDir, archiveDir);

  const store = new ReferencesStore(repoRoot);
  const rewriteResult = await store.rewriteDerivedOutputPaths(pathMap);

  return {
    change_id: changeId,
    archive_dir: archiveDir,
    archived_files: Object.values(pathMap).sort(),
    updated_specs: Array.from(specUpdates.keys()).sort(),
    linked_artifacts: rewriteResult.updated,
  };
}
