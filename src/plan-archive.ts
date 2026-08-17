import { promises as fs } from "node:fs";
import path from "node:path";

import { applyDeltaToCurrentSpec, parseDeltaSpec } from "./plan-contract.js";
import { resolvePlanningPath } from "./planning-paths.js";
import { validatePlanningChange } from "./plan-runtime.js";
import { ReferencesStore } from "./storage.js";

export interface PlanArchiveResult {
  change_id: string;
  archive_dir: string;
  archived_files: string[];
  updated_specs: string[];
  linked_artifacts: number;
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
    if (entry.isFile()) files.push(fullPath);
  }

  return files.sort();
}

async function buildSpecUpdates(repoRoot: string, changeId: string, changeDir: string): Promise<Map<string, string>> {
  const specsRoot = path.join(changeDir, "specs");
  const capabilities = await fs.readdir(specsRoot, { withFileTypes: true });
  const updates = new Map<string, string>();

  for (const entry of capabilities.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const capability = entry.name;
    const deltaPath = path.join(specsRoot, capability, "spec.md");
    const deltaContent = await fs.readFile(deltaPath, "utf8");
    const relDeltaPath = path.relative(changeDir, deltaPath).split(path.sep).join("/");
    const parsed = parseDeltaSpec(deltaContent, relDeltaPath);
    if (parsed.errors.length > 0) {
      throw new Error(parsed.errors.join("; "));
    }

    const currentSpecPath = resolvePlanningPath(repoRoot, "specs", capability, "spec.md");
    const currentContent = await fs.readFile(currentSpecPath, "utf8").catch(() => undefined);
    const applied = applyDeltaToCurrentSpec({
      capability,
      changeId,
      delta: parsed.delta,
      currentContent,
      currentRelPath: path.relative(repoRoot, currentSpecPath).split(path.sep).join("/"),
    });
    if (!applied.content || applied.errors.length > 0) {
      throw new Error(applied.errors.join("; ") || `${relDeltaPath}: could not build canonical spec update`);
    }
    updates.set(currentSpecPath, applied.content);
  }

  return updates;
}

export async function archivePlanningChange(repoRoot: string, changeId: string): Promise<PlanArchiveResult> {
  const validation = await validatePlanningChange(repoRoot, changeId);
  if (!validation.ok) {
    throw new Error(`cannot archive invalid change "${changeId}": ${validation.errors.join("; ")}`);
  }

  const changeDir = resolvePlanningPath(repoRoot, "changes", changeId);
  if (!(await pathExists(changeDir))) {
    throw new Error(`change not found: ${changeId}`);
  }

  const archiveDir = resolvePlanningPath(repoRoot, "changes", "archive", `${archiveDatePrefix()}-${changeId}`);
  if (await pathExists(archiveDir)) {
    throw new Error(`archive destination already exists: ${path.relative(repoRoot, archiveDir).split(path.sep).join("/")}`);
  }

  // Complete all content and traceability planning before the first mutation.
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
  const activeChangePrefix = path.relative(repoRoot, changeDir).split(path.sep).join("/");
  const store = new ReferencesStore(repoRoot);
  const traceability = await store.prepareDerivedOutputReconciliation(pathMap, activeChangePrefix);

  for (const [specPath, content] of specUpdates) {
    await fs.mkdir(path.dirname(specPath), { recursive: true });
    await fs.writeFile(specPath, content, "utf8");
  }

  await fs.mkdir(path.dirname(archiveDir), { recursive: true });
  await fs.rename(changeDir, archiveDir);
  await traceability.commit();

  return {
    change_id: changeId,
    archive_dir: archiveDir,
    archived_files: Object.values(pathMap).sort(),
    updated_specs: Array.from(specUpdates.keys()).sort(),
    linked_artifacts: traceability.updated,
  };
}
