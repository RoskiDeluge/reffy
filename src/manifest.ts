import { promises as fs } from "node:fs";
import path from "node:path";
import { lookup as mimeLookup } from "mime-types";

import type { Artifact, Manifest } from "./types.js";

export const MANIFEST_VERSION = 1;

const KIND_EXTENSIONS: Record<string, string[]> = {
  note: [".md"],
  json: [".json"],
  diagram: [".excalidraw"],
  image: [".png", ".jpg", ".jpeg"],
  html: [".html", ".htm"],
  pdf: [".pdf"],
  doc: [".doc", ".docx"],
  file: [],
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return !Number.isNaN(Date.parse(value));
}

function relativePathSafe(filename: string): boolean {
  if (path.isAbsolute(filename)) return false;
  const normalized = path.normalize(filename);
  return !normalized.startsWith("..") && !normalized.includes(`${path.sep}..${path.sep}`);
}

export function allowedKindExtensions(): Record<string, string[]> {
  return Object.fromEntries(Object.entries(KIND_EXTENSIONS).map(([kind, extensions]) => [kind, [...extensions]]));
}

export function inferArtifactType(filePath: string): { kind: string; mime_type: string } {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".excalidraw") return { kind: "diagram", mime_type: "application/json" };
  if (ext === ".png") return { kind: "image", mime_type: "image/png" };
  if (ext === ".jpg" || ext === ".jpeg") return { kind: "image", mime_type: "image/jpeg" };
  if (ext === ".html" || ext === ".htm") return { kind: "html", mime_type: "text/html" };
  if (ext === ".pdf") return { kind: "pdf", mime_type: "application/pdf" };
  if (ext === ".doc") return { kind: "doc", mime_type: "application/msword" };
  if (ext === ".docx") {
    return {
      kind: "doc",
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
  if (ext === ".json") return { kind: "json", mime_type: "application/json" };
  if (ext === ".md") return { kind: "note", mime_type: "text/markdown" };
  const guessed = mimeLookup(path.basename(filePath)) || "application/octet-stream";
  return { kind: "file", mime_type: guessed.toString() };
}

export interface ManifestValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  artifact_count: number;
}

function validateArtifactShape(value: unknown, index: number, errors: string[]): value is Artifact {
  if (!isObject(value)) {
    errors.push(`artifacts[${index}] must be an object`);
    return false;
  }

  const requiredStringFields = ["id", "name", "filename", "kind", "mime_type", "created_at", "updated_at"] as const;
  for (const field of requiredStringFields) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      errors.push(`artifacts[${index}].${field} must be a non-empty string`);
    }
  }

  if (typeof value.size_bytes !== "number" || Number.isNaN(value.size_bytes) || value.size_bytes < 0) {
    errors.push(`artifacts[${index}].size_bytes must be a non-negative number`);
  }

  if (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== "string")) {
    errors.push(`artifacts[${index}].tags must be an array of strings`);
  }

  if (!isIsoDate(value.created_at)) {
    errors.push(`artifacts[${index}].created_at must be an ISO timestamp`);
  }
  if (!isIsoDate(value.updated_at)) {
    errors.push(`artifacts[${index}].updated_at must be an ISO timestamp`);
  }

  return true;
}

export async function validateManifest(manifestPath: string, artifactsDir: string): Promise<ManifestValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(manifestPath, "utf8")) as unknown;
  } catch (error) {
    return {
      ok: false,
      errors: [`manifest read/parse failed: ${String(error)}`],
      warnings,
      artifact_count: 0,
    };
  }

  if (!isObject(raw)) {
    return { ok: false, errors: ["manifest root must be an object"], warnings, artifact_count: 0 };
  }

  if (raw.version !== MANIFEST_VERSION) {
    errors.push(`version must be ${String(MANIFEST_VERSION)}`);
  }
  if (!isIsoDate(raw.created_at)) {
    errors.push("created_at must be an ISO timestamp");
  }
  if (!isIsoDate(raw.updated_at)) {
    errors.push("updated_at must be an ISO timestamp");
  }
  if (!Array.isArray(raw.artifacts)) {
    errors.push("artifacts must be an array");
  }

  const artifacts = Array.isArray(raw.artifacts) ? (raw.artifacts as unknown[]) : [];
  const seenIds = new Set<string>();
  const seenFiles = new Set<string>();
  const kinds = new Set(Object.keys(KIND_EXTENSIONS));

  for (let index = 0; index < artifacts.length; index += 1) {
    const item = artifacts[index];
    if (!validateArtifactShape(item, index, errors)) continue;

    if (seenIds.has(item.id)) errors.push(`duplicate artifact id: ${item.id}`);
    seenIds.add(item.id);

    if (seenFiles.has(item.filename)) errors.push(`duplicate artifact filename: ${item.filename}`);
    seenFiles.add(item.filename);

    if (!relativePathSafe(item.filename)) {
      errors.push(`artifacts[${index}].filename must be a safe relative path`);
      continue;
    }

    if (!kinds.has(item.kind)) {
      errors.push(`artifacts[${index}].kind must be one of: ${Array.from(kinds).join(", ")}`);
    } else {
      const ext = path.extname(item.filename).toLowerCase();
      const allowed = KIND_EXTENSIONS[item.kind];
      if (allowed.length > 0 && !allowed.includes(ext)) {
        errors.push(`artifacts[${index}] kind "${item.kind}" requires one of: ${allowed.join(", ")}`);
      }
    }

    const artifactPath = path.join(artifactsDir, item.filename);
    const stat = await fs.stat(artifactPath).catch(() => null);
    if (!stat || !stat.isFile()) {
      errors.push(`artifacts[${index}] file is missing: ${item.filename}`);
      continue;
    }

    if (stat.size !== item.size_bytes) {
      warnings.push(
        `artifacts[${index}] size_bytes (${String(item.size_bytes)}) differs from disk size (${String(stat.size)})`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    artifact_count: artifacts.length,
  };
}

export function isManifest(value: unknown): value is Manifest {
  return isObject(value) && Array.isArray(value.artifacts) && value.version === MANIFEST_VERSION;
}
