import { existsSync, statSync } from "node:fs";
import path from "node:path";

import { DEFAULT_REFS_DIRNAME } from "./refs-paths.js";

export const DEFAULT_PLANNING_DIRNAME = "reffyspec";
export const DEFAULT_PLANNING_RELATIVE_DIR = `${DEFAULT_REFS_DIRNAME}/${DEFAULT_PLANNING_DIRNAME}`;
export const LEGACY_PLANNING_DIRNAME = "reffyspec";
export const COMPAT_PLANNING_DIRNAME = "openspec";

export type PlanningMode = "canonical" | "legacy" | "compat" | "dual" | "new";

export interface PlanningState {
  canonicalDir: string;
  legacyDir: string;
  compatDir: string;
  canonicalExists: boolean;
  legacyExists: boolean;
  compatExists: boolean;
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
  return path.join(repoRoot, DEFAULT_REFS_DIRNAME, DEFAULT_PLANNING_DIRNAME);
}

export function resolveLegacyPlanningDir(repoRoot: string): string {
  return path.join(repoRoot, LEGACY_PLANNING_DIRNAME);
}

export function resolveCompatPlanningDir(repoRoot: string): string {
  return path.join(repoRoot, COMPAT_PLANNING_DIRNAME);
}

export function resolveCanonicalPlanningPath(repoRoot: string, ...parts: string[]): string {
  return path.join(resolveCanonicalPlanningDir(repoRoot), ...parts);
}

export function resolvePlanningPath(repoRoot: string, ...parts: string[]): string {
  return path.join(resolvePlanningDir(repoRoot), ...parts);
}

export function detectPlanningState(repoRoot: string): PlanningState {
  const canonicalDir = resolveCanonicalPlanningDir(repoRoot);
  const legacyDir = resolveLegacyPlanningDir(repoRoot);
  const compatDir = resolveCompatPlanningDir(repoRoot);
  const canonicalExists = isDirectory(canonicalDir);
  const legacyExists = isDirectory(legacyDir);
  const compatExists = isDirectory(compatDir);

  let mode: PlanningMode = "new";
  if (canonicalExists && (legacyExists || compatExists)) {
    mode = "dual";
  } else if (canonicalExists) {
    mode = "canonical";
  } else if (legacyExists) {
    mode = "legacy";
  } else if (compatExists) {
    mode = "compat";
  }

  const activeDirName =
    mode === "legacy"
      ? LEGACY_PLANNING_DIRNAME
      : mode === "compat"
        ? COMPAT_PLANNING_DIRNAME
        : DEFAULT_PLANNING_RELATIVE_DIR;

  return {
    canonicalDir,
    legacyDir,
    compatDir,
    canonicalExists,
    legacyExists,
    compatExists,
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
    (base === DEFAULT_PLANNING_DIRNAME || base === COMPAT_PLANNING_DIRNAME) &&
    existsSync(path.join(targetPath, "changes")) &&
    existsSync(path.join(targetPath, "specs"))
  );
}
