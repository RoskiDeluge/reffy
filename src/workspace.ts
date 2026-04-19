import { promises as fs } from "node:fs";
import path from "node:path";

import { deriveManifestIdentity, normalizeManifest } from "./manifest.js";
import {
  DEFAULT_REFS_DIRNAME,
  LEGACY_REFS_DIRNAME,
  detectWorkspaceState,
  resolveCanonicalRefsDir,
  type WorkspaceState,
} from "./refs-paths.js";

export interface WorkspacePreparationResult {
  state: WorkspaceState;
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

async function ensureCanonicalStructure(repoRoot: string): Promise<boolean> {
  const refsDir = resolveCanonicalRefsDir(repoRoot);
  const artifactsDir = path.join(refsDir, "artifacts");
  const manifestPath = path.join(refsDir, "manifest.json");
  let created = false;

  if (!(await pathExists(refsDir))) {
    created = true;
  }

  await fs.mkdir(artifactsDir, { recursive: true });
  if (!(await pathExists(manifestPath))) {
    await fs.writeFile(
      manifestPath,
      JSON.stringify(normalizeManifest(undefined, repoRoot), null, 2),
      "utf8",
    );
  } else {
    const rawText = await fs.readFile(manifestPath, "utf8").catch(() => null);
    if (rawText) {
      try {
        const raw = JSON.parse(rawText) as unknown;
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          const record = raw as Record<string, unknown>;
          const defaults = deriveManifestIdentity(repoRoot);
          const missingIdentity = record.project_id === undefined || record.workspace_name === undefined;
          if (missingIdentity) {
            const nextManifest = normalizeManifest(raw, repoRoot);
            nextManifest.updated_at = new Date().toISOString();
            await fs.writeFile(manifestPath, JSON.stringify(nextManifest, null, 2), "utf8");
          }
        }
      } catch {
        // Leave invalid manifests untouched so validation can report the problem explicitly.
      }
    }
  }

  return created;
}

export async function prepareCanonicalWorkspace(repoRoot: string): Promise<WorkspacePreparationResult> {
  const current = detectWorkspaceState(repoRoot);

  if (current.mode === "legacy") {
    await fs.rename(current.legacyDir, current.canonicalDir);
    const state = detectWorkspaceState(repoRoot);
    return {
      state,
      migrated: true,
      created: false,
      message: `Migrated ${LEGACY_REFS_DIRNAME}/ to ${DEFAULT_REFS_DIRNAME}/`,
    };
  }

  const created = await ensureCanonicalStructure(repoRoot);
  return {
    state: detectWorkspaceState(repoRoot),
    migrated: false,
    created,
  };
}
