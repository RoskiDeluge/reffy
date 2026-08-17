import { promises as fs } from "node:fs";
import path from "node:path";

import { applyDeltaToCurrentSpec, parseDeltaSpec } from "./plan-contract.js";
import { resolvePlanningPath } from "./planning-paths.js";

const CHANGE_HEADING_PREFIX = "# Change:";
const UNEXPECTED_PATH_GUIDANCE =
  "Move durable decisions to design.md, checklist work to tasks.md, or exploratory context to .reffy/artifacts/.";

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

interface ChangeTreeInspection {
  errors: string[];
  specFiles: string[];
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
    const specPath = path.join(specsDir, capability, "spec.md");
    const stat = await fs.stat(specPath).catch(() => null);
    if (stat?.isFile()) files.push(specPath);
  }

  return files.sort();
}

function toRelativeChangePath(changeDir: string, targetPath: string): string {
  return path.relative(changeDir, targetPath).split(path.sep).join("/");
}

function unexpectedPathError(relativePath: string, detail?: string): string {
  const suffix = detail ? ` (${detail})` : "";
  return `unexpected change path: ${relativePath}${suffix}. ${UNEXPECTED_PATH_GUIDANCE}`;
}

async function collectUnexpectedTree(
  changeDir: string,
  targetPath: string,
  errors: string[],
  detail?: string,
): Promise<void> {
  errors.push(unexpectedPathError(toRelativeChangePath(changeDir, targetPath), detail));
  const targetStat = await fs.lstat(targetPath).catch(() => null);
  if (!targetStat?.isDirectory() || targetStat.isSymbolicLink()) return;
  const entries = await fs.readdir(targetPath, { withFileTypes: true }).catch(() => []);
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    await collectUnexpectedTree(changeDir, path.join(targetPath, entry.name), errors);
  }
}

async function inspectChangeTree(paths: ChangePaths): Promise<ChangeTreeInspection> {
  const errors: string[] = [];
  const specFiles: string[] = [];
  const topEntries = await fs.readdir(paths.changeDir, { withFileTypes: true }).catch(() => []);
  const topByName = new Map(topEntries.map((entry) => [entry.name, entry]));
  const allowedTopLevel = new Set(["proposal.md", "tasks.md", "design.md", "specs"]);

  for (const entry of topEntries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!allowedTopLevel.has(entry.name)) {
      await collectUnexpectedTree(paths.changeDir, path.join(paths.changeDir, entry.name), errors);
    }
  }

  for (const requiredFile of ["proposal.md", "tasks.md"]) {
    const entry = topByName.get(requiredFile);
    if (!entry) {
      errors.push(`missing required file: ${requiredFile}`);
    } else if (!entry.isFile()) {
      await collectUnexpectedTree(paths.changeDir, path.join(paths.changeDir, requiredFile), errors, "expected a file");
    }
  }

  const designEntry = topByName.get("design.md");
  if (designEntry && !designEntry.isFile()) {
    await collectUnexpectedTree(paths.changeDir, paths.designPath, errors, "expected a file");
  }

  const specsEntry = topByName.get("specs");
  if (!specsEntry) {
    errors.push("missing required directory: specs/");
  } else if (!specsEntry.isDirectory()) {
    await collectUnexpectedTree(paths.changeDir, paths.specsDir, errors, "expected a directory");
  } else {
    const capabilityEntries = await fs.readdir(paths.specsDir, { withFileTypes: true });
    for (const capabilityEntry of capabilityEntries.sort((a, b) => a.name.localeCompare(b.name))) {
      const capabilityPath = path.join(paths.specsDir, capabilityEntry.name);
      if (!capabilityEntry.isDirectory()) {
        await collectUnexpectedTree(paths.changeDir, capabilityPath, errors, "expected a capability directory");
        continue;
      }

      const entries = await fs.readdir(capabilityPath, { withFileTypes: true });
      const specEntry = entries.find((entry) => entry.name === "spec.md");
      if (!specEntry) {
        errors.push(`missing required file: specs/${capabilityEntry.name}/spec.md`);
      } else if (!specEntry.isFile()) {
        await collectUnexpectedTree(
          paths.changeDir,
          path.join(capabilityPath, "spec.md"),
          errors,
          "expected a file",
        );
      } else {
        specFiles.push(path.join(capabilityPath, "spec.md"));
      }

      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name === "spec.md") continue;
        await collectUnexpectedTree(paths.changeDir, path.join(capabilityPath, entry.name), errors);
      }
    }
  }

  if (specFiles.length === 0 && specsEntry?.isDirectory()) {
    errors.push("specs/ must contain at least one delta spec file");
  }

  return { errors, specFiles: specFiles.sort() };
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

  const tree = await inspectChangeTree(paths);
  errors.push(...tree.errors);

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

  for (const filePath of tree.specFiles) {
    const relPath = path.relative(paths.changeDir, filePath).split(path.sep).join("/");
    const content = await fs.readFile(filePath, "utf8").catch(() => "");
    const parsed = parseDeltaSpec(content, relPath);
    errors.push(...parsed.errors);
    if (parsed.errors.length > 0) continue;

    const capability = path.basename(path.dirname(filePath));
    const currentSpecPath = resolvePlanningPath(repoRoot, "specs", capability, "spec.md");
    const currentContent = await fs.readFile(currentSpecPath, "utf8").catch(() => undefined);
    const applied = applyDeltaToCurrentSpec({
      capability,
      changeId,
      delta: parsed.delta,
      currentContent,
      currentRelPath: path.relative(repoRoot, currentSpecPath).split(path.sep).join("/"),
    });
    errors.push(...applied.errors);
  }

  return {
    ok: errors.length === 0,
    change_id: changeId,
    errors,
    warnings,
    delta_count: tree.specFiles.length,
    task_status: taskStatus,
  };
}
