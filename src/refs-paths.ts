import { existsSync, statSync } from "node:fs";
import path from "node:path";

export const DEFAULT_REFS_DIRNAME = ".reffy";
export const LEGACY_REFS_DIRNAME = ".references";

export type WorkspaceMode = "canonical" | "legacy" | "dual" | "new";

export interface WorkspaceState {
  canonicalDir: string;
  legacyDir: string;
  canonicalExists: boolean;
  legacyExists: boolean;
  mode: WorkspaceMode;
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

export function resolveRefsDirName(repoRoot: string): string {
  return detectWorkspaceState(repoRoot).activeDirName;
}

export function resolveRefsDir(repoRoot: string): string {
  return path.join(repoRoot, resolveRefsDirName(repoRoot));
}

export function resolveCanonicalRefsDir(repoRoot: string): string {
  return path.join(repoRoot, DEFAULT_REFS_DIRNAME);
}

export function resolveLegacyRefsDir(repoRoot: string): string {
  return path.join(repoRoot, LEGACY_REFS_DIRNAME);
}

export function detectWorkspaceState(repoRoot: string): WorkspaceState {
  const canonicalDir = resolveCanonicalRefsDir(repoRoot);
  const legacyDir = resolveLegacyRefsDir(repoRoot);
  const canonicalExists = isDirectory(canonicalDir);
  const legacyExists = isDirectory(legacyDir);

  let mode: WorkspaceMode = "new";
  if (canonicalExists && legacyExists) {
    mode = "dual";
  } else if (canonicalExists) {
    mode = "canonical";
  } else if (legacyExists) {
    mode = "legacy";
  }

  const activeDirName =
    mode === "legacy" ? LEGACY_REFS_DIRNAME : DEFAULT_REFS_DIRNAME;
  const activeDir = path.join(repoRoot, activeDirName);

  return {
    canonicalDir,
    legacyDir,
    canonicalExists,
    legacyExists,
    mode,
    activeDirName,
    activeDir,
  };
}

export function looksLikeRefsDir(targetPath: string): boolean {
  const base = path.basename(targetPath);
  return (
    (base === DEFAULT_REFS_DIRNAME || base === LEGACY_REFS_DIRNAME) &&
    existsSync(path.join(targetPath, "artifacts")) &&
    isDirectory(path.join(targetPath, "artifacts"))
  );
}
