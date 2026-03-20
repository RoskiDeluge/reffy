import { promises as fs } from "node:fs";
import path from "node:path";

import {
  DEFAULT_PLANNING_DIRNAME,
  LEGACY_PLANNING_DIRNAME,
  detectPlanningState,
  resolveCanonicalPlanningDir,
  type PlanningState,
} from "./planning-paths.js";

export interface PlanningPreparationResult {
  state: PlanningState;
  migrated: boolean;
  created: boolean;
  message?: string;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureCanonicalPlanningStructure(repoRoot: string): Promise<boolean> {
  const planningDir = resolveCanonicalPlanningDir(repoRoot);
  let created = false;

  if (!(await pathExists(planningDir))) {
    created = true;
  }

  await fs.mkdir(path.join(planningDir, "changes", "archive"), { recursive: true });
  await fs.mkdir(path.join(planningDir, "specs"), { recursive: true });
  return created;
}

export async function prepareCanonicalPlanningLayout(repoRoot: string): Promise<PlanningPreparationResult> {
  const current = detectPlanningState(repoRoot);

  if (current.mode === "legacy") {
    await fs.rename(current.legacyDir, current.canonicalDir);
    return {
      state: detectPlanningState(repoRoot),
      migrated: true,
      created: false,
      message: `Migrated ${LEGACY_PLANNING_DIRNAME}/ to ${DEFAULT_PLANNING_DIRNAME}/`,
    };
  }

  const created = await ensureCanonicalPlanningStructure(repoRoot);
  return {
    state: detectPlanningState(repoRoot),
    migrated: false,
    created,
  };
}
