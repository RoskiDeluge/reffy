import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { lookup as mimeLookup } from "mime-types";

import type { Artifact, Manifest } from "./types.js";

const MANIFEST_VERSION = 1;

function utcNow(): string {
  return new Date().toISOString();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class ReferencesStore {
  public readonly repoRoot: string;
  public readonly refsDir: string;
  public readonly artifactsDir: string;
  public readonly manifestPath: string;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
    this.refsDir = path.join(repoRoot, ".references");
    this.artifactsDir = path.join(this.refsDir, "artifacts");
    this.manifestPath = path.join(this.refsDir, "manifest.json");
    this.ensureStructure();
  }

  private ensureStructure(): void {
    mkdirSync(this.refsDir, { recursive: true });
    mkdirSync(this.artifactsDir, { recursive: true });
    void fs.access(this.manifestPath).catch(async () => {
      await this.writeManifest(this.emptyManifest());
    });
  }

  private emptyManifest(): Manifest {
    const now = utcNow();
    return {
      version: MANIFEST_VERSION,
      created_at: now,
      updated_at: now,
      artifacts: [],
      conflicts: [],
    };
  }

  private async readManifest(): Promise<Manifest> {
    let raw: unknown;
    try {
      const text = await fs.readFile(this.manifestPath, "utf8");
      raw = JSON.parse(text) as unknown;
    } catch {
      return this.emptyManifest();
    }

    if (Array.isArray(raw)) {
      return {
        version: 0,
        created_at: utcNow(),
        updated_at: utcNow(),
        artifacts: raw as Artifact[],
        conflicts: [],
      };
    }

    if (!isObject(raw)) {
      return this.emptyManifest();
    }

    const artifacts = Array.isArray(raw.artifacts) ? (raw.artifacts as Artifact[]) : [];
    const conflicts = Array.isArray(raw.conflicts) ? raw.conflicts : [];

    return {
      version: typeof raw.version === "number" ? raw.version : MANIFEST_VERSION,
      created_at: typeof raw.created_at === "string" ? raw.created_at : utcNow(),
      updated_at: typeof raw.updated_at === "string" ? raw.updated_at : utcNow(),
      artifacts,
      conflicts: conflicts as Manifest["conflicts"],
    };
  }

  private async writeManifest(manifest: Manifest): Promise<void> {
    await fs.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2));
  }

  public async listArtifacts(): Promise<Artifact[]> {
    const manifest = await this.readManifest();
    return manifest.artifacts;
  }

  public async getArtifact(artifactId: string): Promise<Artifact | null> {
    const manifest = await this.readManifest();
    return manifest.artifacts.find((item) => item.id === artifactId) ?? null;
  }

  public getArtifactPath(artifact: Artifact): string {
    return path.join(this.artifactsDir, artifact.filename);
  }

  private slugify(name: string): string {
    const cleaned = name
      .split("")
      .filter((ch) => /[\w\- ]/.test(ch))
      .join("")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();
    return cleaned || "untitled";
  }

  private async uniqueFilename(base: string, ext = ".md"): Promise<string> {
    let candidate = `${base}${ext}`;
    let counter = 2;
    while (true) {
      try {
        await fs.access(path.join(this.artifactsDir, candidate));
        candidate = `${base}-${counter}${ext}`;
        counter += 1;
      } catch {
        return candidate;
      }
    }
  }

  public async createArtifact(input: {
    name: string;
    content?: string | null;
    kind?: string | null;
    mime_type?: string | null;
    tags?: string[] | null;
  }): Promise<Artifact> {
    const id = randomUUID();
    const safe = this.slugify(input.name);
    const filename = await this.uniqueFilename(safe, ".md");
    const now = utcNow();
    const artifactPath = path.join(this.artifactsDir, filename);

    if (input.content !== undefined && input.content !== null) {
      await fs.writeFile(artifactPath, input.content, "utf8");
    }

    let sizeBytes = 0;
    try {
      const stat = await fs.stat(artifactPath);
      sizeBytes = stat.size;
    } catch {
      sizeBytes = 0;
    }

    const artifact: Artifact = {
      id,
      name: input.name,
      filename,
      kind: input.kind ?? "note",
      mime_type: input.mime_type ?? "text/markdown",
      size_bytes: sizeBytes,
      tags: input.tags ?? [],
      created_at: now,
      updated_at: now,
    };

    const manifest = await this.readManifest();
    manifest.updated_at = utcNow();
    manifest.artifacts.push(artifact);
    await this.writeManifest(manifest);
    return artifact;
  }

  private inferKind(filePath: string): { kind: string; mime_type: string } {
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

  public async reindexArtifacts(): Promise<{ added: number; total: number }> {
    const manifest = await this.readManifest();
    const known = new Set(manifest.artifacts.map((a) => a.filename));
    const entries = await fs.readdir(this.artifactsDir, { withFileTypes: true });
    let added = 0;

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (known.has(entry.name)) continue;
      const filePath = path.join(this.artifactsDir, entry.name);
      const stats = await fs.stat(filePath);
      const now = utcNow();
      const inferred = this.inferKind(filePath);
      const artifact: Artifact = {
        id: randomUUID(),
        name: path.basename(entry.name, path.extname(entry.name)).replace(/-/g, " ").trim() || "untitled",
        filename: entry.name,
        kind: inferred.kind,
        mime_type: inferred.mime_type,
        size_bytes: stats.size,
        tags: [],
        created_at: now,
        updated_at: now,
      };
      manifest.artifacts.push(artifact);
      added += 1;
    }

    if (added > 0) {
      manifest.updated_at = utcNow();
      await this.writeManifest(manifest);
    }

    return { added, total: manifest.artifacts.length };
  }

  public async updateArtifact(
    artifactId: string,
    input: {
      name?: string | null;
      content?: string | null;
      kind?: string | null;
      mime_type?: string | null;
      tags?: string[] | null;
    },
  ): Promise<Artifact | null> {
    const manifest = await this.readManifest();
    const index = manifest.artifacts.findIndex((item) => item.id === artifactId);
    if (index === -1) return null;

    const item = manifest.artifacts[index];
    if (input.name !== undefined && input.name !== null) item.name = input.name;
    if (input.kind !== undefined && input.kind !== null) item.kind = input.kind;
    if (input.mime_type !== undefined && input.mime_type !== null) item.mime_type = input.mime_type;
    if (input.tags !== undefined && input.tags !== null) item.tags = input.tags;

    if (input.content !== undefined && input.content !== null) {
      const artifactPath = this.getArtifactPath(item);
      await fs.writeFile(artifactPath, input.content, "utf8");
      const stat = await fs.stat(artifactPath);
      item.size_bytes = stat.size;
    }

    item.updated_at = utcNow();
    manifest.updated_at = utcNow();
    manifest.artifacts[index] = item;
    await this.writeManifest(manifest);
    return item;
  }

  public async deleteArtifact(artifactId: string): Promise<boolean> {
    const manifest = await this.readManifest();
    const index = manifest.artifacts.findIndex((item) => item.id === artifactId);
    if (index === -1) return false;

    const [removed] = manifest.artifacts.splice(index, 1);
    const artifactPath = this.getArtifactPath(removed);
    await fs.rm(artifactPath, { force: true });

    manifest.updated_at = utcNow();
    await this.writeManifest(manifest);
    return true;
  }

  public async recordConflict(input: {
    artifact_id: string;
    source: string;
    note: string;
    conflict_artifact_id?: string | null;
  }): Promise<void> {
    const manifest = await this.readManifest();
    manifest.conflicts.push({
      artifact_id: input.artifact_id,
      source: input.source,
      note: input.note,
      conflict_artifact_id: input.conflict_artifact_id ?? null,
      created_at: utcNow(),
    });
    manifest.updated_at = utcNow();
    await this.writeManifest(manifest);
  }

  public async createConflictCopy(input: {
    artifact_id: string;
    source: string;
    note: string;
  }): Promise<Artifact | null> {
    const original = await this.getArtifact(input.artifact_id);
    if (!original) return null;

    const originalPath = this.getArtifactPath(original);
    let content: string;
    try {
      content = await fs.readFile(originalPath, "utf8");
    } catch {
      return null;
    }

    const conflict = await this.createArtifact({
      name: `${original.name} (conflict)`,
      content,
      kind: original.kind,
      mime_type: original.mime_type,
      tags: [...original.tags, "conflict"],
    });

    await this.recordConflict({
      artifact_id: input.artifact_id,
      source: input.source,
      note: input.note,
      conflict_artifact_id: conflict.id,
    });

    return conflict;
  }
}
