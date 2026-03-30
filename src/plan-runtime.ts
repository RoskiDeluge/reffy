import { promises as fs } from "node:fs";
import path from "node:path";

import { resolvePlanningPath } from "./planning-paths.js";

const CHANGE_HEADING_PREFIX = "# Change:";
const REQUIREMENT_SECTION_PATTERN = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/;
const REQUIREMENT_HEADING_PATTERN = /^###\s+Requirement:\s+(.+)$/;
const SCENARIO_HEADING_PATTERN = /^####\s+Scenario:\s+(.+)$/;
const BAD_SCENARIO_PATTERNS = [/^###\s+Scenario:/, /^- \*\*Scenario:/, /^\*\*Scenario\*\*:/];

export interface TaskStatus {
  total: number;
  completed: number;
}

export interface PlanChangeSummary {
  id: string;
  title: string;
  change_dir: string;
  proposal_path: string;
  tasks_path: string;
  design_path?: string;
  delta_count: number;
  task_status: TaskStatus;
}

export interface PlanShowResult extends PlanChangeSummary {
  proposal: string;
  tasks: string;
  design?: string;
  specs: Array<{ capability: string; path: string; content: string }>;
}

export interface PlanValidationResult {
  ok: boolean;
  change_id: string;
  errors: string[];
  warnings: string[];
  delta_count: number;
  task_status: TaskStatus;
}

interface ChangePaths {
  id: string;
  changeDir: string;
  proposalPath: string;
  tasksPath: string;
  designPath: string;
  specsDir: string;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listDirectories(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

function getChangePaths(repoRoot: string, changeId: string): ChangePaths {
  const changeDir = resolvePlanningPath(repoRoot, "changes", changeId);
  return {
    id: changeId,
    changeDir,
    proposalPath: path.join(changeDir, "proposal.md"),
    tasksPath: path.join(changeDir, "tasks.md"),
    designPath: path.join(changeDir, "design.md"),
    specsDir: path.join(changeDir, "specs"),
  };
}

async function listSpecFiles(specsDir: string): Promise<string[]> {
  const capabilities = await listDirectories(specsDir);
  const files: string[] = [];

  for (const capability of capabilities) {
    const capabilityDir = path.join(specsDir, capability);
    const entries = await fs.readdir(capabilityDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      files.push(path.join(capabilityDir, entry.name));
    }
  }

  return files.sort();
}

function countTasks(content: string): TaskStatus {
  const matches = content.matchAll(/^- \[( |x)\] /gm);
  let total = 0;
  let completed = 0;
  for (const match of matches) {
    total += 1;
    if (match[1] === "x") completed += 1;
  }
  return { total, completed };
}

function extractTitle(content: string, fallback: string): string {
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith(CHANGE_HEADING_PREFIX)) {
      return line.slice(CHANGE_HEADING_PREFIX.length).trim() || fallback;
    }
    if (line.startsWith("# ")) {
      return line.slice(2).trim() || fallback;
    }
  }
  return fallback;
}

function validateSpecContent(content: string, relPath: string, errors: string[]): void {
  const lines = content.split(/\r?\n/);
  let sectionCount = 0;
  let requirementCount = 0;
  let scenarioCount = 0;
  let currentRequirement: string | null = null;
  let currentRequirementScenarios = 0;

  const finalizeRequirement = (): void => {
    if (currentRequirement !== null && currentRequirementScenarios === 0) {
      errors.push(`${relPath}: requirement "${currentRequirement}" must include at least one scenario`);
    }
  };

  for (const line of lines) {
    if (REQUIREMENT_SECTION_PATTERN.test(line)) {
      sectionCount += 1;
      continue;
    }

    const requirementMatch = line.match(REQUIREMENT_HEADING_PATTERN);
    if (requirementMatch) {
      finalizeRequirement();
      requirementCount += 1;
      currentRequirement = requirementMatch[1]?.trim() ?? "unknown";
      currentRequirementScenarios = 0;
      continue;
    }

    const scenarioMatch = line.match(SCENARIO_HEADING_PATTERN);
    if (scenarioMatch) {
      scenarioCount += 1;
      currentRequirementScenarios += 1;
      continue;
    }

    if (BAD_SCENARIO_PATTERNS.some((pattern) => pattern.test(line))) {
      errors.push(`${relPath}: scenarios must use "#### Scenario:" headings`);
    }
  }

  finalizeRequirement();

  if (sectionCount === 0) {
    errors.push(`${relPath}: must include at least one "## ADDED|MODIFIED|REMOVED|RENAMED Requirements" section`);
  }
  if (requirementCount === 0) {
    errors.push(`${relPath}: must include at least one "### Requirement:" heading`);
  }
  if (scenarioCount === 0) {
    errors.push(`${relPath}: must include at least one "#### Scenario:" heading`);
  }
}

async function buildChangeSummary(repoRoot: string, changeId: string): Promise<PlanChangeSummary> {
  const paths = getChangePaths(repoRoot, changeId);
  const proposal = await fs.readFile(paths.proposalPath, "utf8");
  const tasks = await fs.readFile(paths.tasksPath, "utf8").catch(() => "");
  const designExists = await pathExists(paths.designPath);
  const specFiles = await listSpecFiles(paths.specsDir);

  return {
    id: changeId,
    title: extractTitle(proposal, changeId),
    change_dir: paths.changeDir,
    proposal_path: paths.proposalPath,
    tasks_path: paths.tasksPath,
    design_path: designExists ? paths.designPath : undefined,
    delta_count: specFiles.length,
    task_status: countTasks(tasks),
  };
}

export async function listPlanningChanges(repoRoot: string): Promise<PlanChangeSummary[]> {
  const changesRoot = resolvePlanningPath(repoRoot, "changes");
  const changeIds = (await listDirectories(changesRoot)).filter((id) => id !== "archive");
  const summaries: PlanChangeSummary[] = [];

  for (const changeId of changeIds) {
    const proposalPath = path.join(changesRoot, changeId, "proposal.md");
    if (!(await pathExists(proposalPath))) continue;
    summaries.push(await buildChangeSummary(repoRoot, changeId));
  }

  return summaries.sort((a, b) => a.id.localeCompare(b.id));
}

export async function showPlanningChange(repoRoot: string, changeId: string): Promise<PlanShowResult> {
  const summary = await buildChangeSummary(repoRoot, changeId);
  const paths = getChangePaths(repoRoot, changeId);
  const proposal = await fs.readFile(paths.proposalPath, "utf8");
  const tasks = await fs.readFile(paths.tasksPath, "utf8");
  const design = await fs.readFile(paths.designPath, "utf8").catch(() => undefined);
  const specFiles = await listSpecFiles(paths.specsDir);
  const specs = await Promise.all(
    specFiles.map(async (filePath) => ({
      capability: path.basename(path.dirname(filePath)),
      path: filePath,
      content: await fs.readFile(filePath, "utf8"),
    })),
  );

  return {
    ...summary,
    proposal,
    tasks,
    design,
    specs,
  };
}

export async function validatePlanningChange(repoRoot: string, changeId: string): Promise<PlanValidationResult> {
  const paths = getChangePaths(repoRoot, changeId);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(await pathExists(paths.changeDir))) {
    return {
      ok: false,
      change_id: changeId,
      errors: [`change not found: ${changeId}`],
      warnings,
      delta_count: 0,
      task_status: { total: 0, completed: 0 },
    };
  }

  if (!(await pathExists(paths.proposalPath))) {
    errors.push("missing required file: proposal.md");
  }
  if (!(await pathExists(paths.tasksPath))) {
    errors.push("missing required file: tasks.md");
  }
  if (!(await pathExists(paths.specsDir))) {
    errors.push("missing required directory: specs/");
  }

  const proposal = await fs.readFile(paths.proposalPath, "utf8").catch(() => "");
  if (proposal.length > 0) {
    if (!proposal.includes("## Why")) errors.push("proposal.md must include a '## Why' section");
    if (!proposal.includes("## What Changes")) errors.push("proposal.md must include a '## What Changes' section");
    if (!proposal.includes("## Impact")) errors.push("proposal.md must include a '## Impact' section");
  }

  const tasks = await fs.readFile(paths.tasksPath, "utf8").catch(() => "");
  const taskStatus = countTasks(tasks);
  if (tasks.length > 0 && taskStatus.total === 0) {
    warnings.push("tasks.md does not contain any checkbox tasks");
  }

  const specFiles = await listSpecFiles(paths.specsDir).catch(() => []);
  if (specFiles.length === 0) {
    errors.push("specs/ must contain at least one delta spec file");
  }

  for (const filePath of specFiles) {
    const relPath = path.relative(paths.changeDir, filePath).split(path.sep).join("/");
    const content = await fs.readFile(filePath, "utf8").catch(() => "");
    validateSpecContent(content, relPath, errors);
  }

  return {
    ok: errors.length === 0,
    change_id: changeId,
    errors,
    warnings,
    delta_count: specFiles.length,
    task_status: taskStatus,
  };
}
