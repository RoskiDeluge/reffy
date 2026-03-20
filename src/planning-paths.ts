import { existsSync, statSync } from "node:fs";
import path from "node:path";

export const DEFAULT_PLANNING_DIRNAME = "reffyspec";
export const LEGACY_PLANNING_DIRNAME = "openspec";

export type PlanningMode = "canonical" | "legacy" | "dual" | "new";

export interface PlanningState {
  canonicalDir: string;
  legacyDir: string;
  canonicalExists: boolean;
  legacyExists: boolean;
  mode: PlanningMode;
  activeDirName: string;
  activeDir: string;
}

function isDirectory(targetPath: string): boolean {
  try {
    return statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

export function resolveCanonicalPlanningDir(repoRoot: string): string {
  return path.join(repoRoot, DEFAULT_PLANNING_DIRNAME);
}

export function resolveLegacyPlanningDir(repoRoot: string): string {
  return path.join(repoRoot, LEGACY_PLANNING_DIRNAME);
}

export function detectPlanningState(repoRoot: string): PlanningState {
  const canonicalDir = resolveCanonicalPlanningDir(repoRoot);
  const legacyDir = resolveLegacyPlanningDir(repoRoot);
  const canonicalExists = isDirectory(canonicalDir);
  const legacyExists = isDirectory(legacyDir);

  let mode: PlanningMode = "new";
  if (canonicalExists && legacyExists) {
    mode = "dual";
  } else if (canonicalExists) {
    mode = "canonical";
  } else if (legacyExists) {
    mode = "legacy";
  }

  const activeDirName = mode === "legacy" ? LEGACY_PLANNING_DIRNAME : DEFAULT_PLANNING_DIRNAME;

  return {
    canonicalDir,
    legacyDir,
    canonicalExists,
    legacyExists,
    mode,
    activeDirName,
    activeDir: path.join(repoRoot, activeDirName),
  };
}

export function resolvePlanningDirName(repoRoot: string): string {
  return detectPlanningState(repoRoot).activeDirName;
}

export function resolvePlanningDir(repoRoot: string): string {
  return path.join(repoRoot, resolvePlanningDirName(repoRoot));
}

export function looksLikePlanningDir(targetPath: string): boolean {
  const base = path.basename(targetPath);
  return (
    (base === DEFAULT_PLANNING_DIRNAME || base === LEGACY_PLANNING_DIRNAME) &&
    existsSync(path.join(targetPath, "changes")) &&
    existsSync(path.join(targetPath, "specs"))
  );
}
