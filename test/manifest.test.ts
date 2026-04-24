import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  allowedKindExtensions,
  deriveManifestIdentity,
  inferArtifactType,
  isManifest,
  normalizeManifest,
  validateManifest,
} from "../src/manifest.js";
import { addArtifact, createTempRepo } from "./helpers.js";

describe("manifest module", () => {
  it("returns a defensive copy of allowed extensions", () => {
    const first = allowedKindExtensions();
    first.note.push(".txt");
    const second = allowedKindExtensions();
    expect(second.note).not.toContain(".txt");
  });

  it("infers known and fallback artifact types", () => {
    expect(inferArtifactType("doc.md")).toEqual({ kind: "note", mime_type: "text/markdown" });
    expect(inferArtifactType("image.jpeg")).toEqual({ kind: "image", mime_type: "image/jpeg" });
    expect(inferArtifactType("unknown.bin").kind).toBe("file");
  });

  it("validates a well-formed manifest", async () => {
    const repo = await createTempRepo();
    await addArtifact(repo, {
      filename: "idea.md",
      content: "# Feature Idea\n\n- Test",
    });

    const result = await validateManifest(repo.manifestPath, repo.artifactsDir);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.artifact_count).toBe(1);
  });

  it("accepts older v1 manifests that do not yet include identity fields", async () => {
    const repo = await createTempRepo();
    const now = new Date().toISOString();
    await writeFile(
      repo.manifestPath,
      JSON.stringify(
        {
          version: 1,
          created_at: now,
          updated_at: now,
          artifacts: [],
        },
        null,
        2,
      ),
      "utf8",
    );

    const result = await validateManifest(repo.manifestPath, repo.artifactsDir);
    expect(result.ok).toBe(true);
  });

  it("fails when manifest cannot be parsed", async () => {
    const repo = await createTempRepo();
    await writeFile(repo.manifestPath, "not-json", "utf8");

    const result = await validateManifest(repo.manifestPath, repo.artifactsDir);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("manifest read/parse failed");
  });

  it("fails for duplicate ids, unsafe paths, invalid kind and missing files", async () => {
    const repo = await createTempRepo();
    await mkdir(repo.artifactsDir, { recursive: true });
    await writeFile(path.join(repo.artifactsDir, "valid.md"), "hello", "utf8");

    const now = new Date().toISOString();
    await writeFile(
      repo.manifestPath,
      JSON.stringify(
        {
          version: 1,
          created_at: now,
          updated_at: now,
          artifacts: [
            {
              id: "dup",
              name: "A",
              filename: "valid.md",
              kind: "note",
              mime_type: "text/markdown",
              size_bytes: 5,
              tags: [],
              created_at: now,
              updated_at: now,
            },
            {
              id: "dup",
              name: "B",
              filename: "../escape.md",
              kind: "bad-kind",
              mime_type: "text/plain",
              size_bytes: 0,
              tags: [],
              created_at: "bad-date",
              updated_at: now,
            },
            {
              id: "ok-id",
              name: "C",
              filename: "missing.pdf",
              kind: "pdf",
              mime_type: "application/pdf",
              size_bytes: 1,
              tags: [],
              created_at: now,
              updated_at: now,
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    const result = await validateManifest(repo.manifestPath, repo.artifactsDir);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("duplicate artifact id: dup");
    expect(result.errors.join("\n")).toContain("filename must be a safe relative path");
    expect(result.errors.join("\n")).toContain("created_at must be an ISO timestamp");
    expect(result.errors.join("\n")).toContain("file is missing: missing.pdf");
  });

  it("reports warnings when size_bytes differs from on-disk size", async () => {
    const repo = await createTempRepo();
    const artifact = await addArtifact(repo, {
      filename: "size.md",
      content: "12345",
    });

    await writeFile(
      repo.manifestPath,
      JSON.stringify(
        {
          version: 1,
          created_at: artifact.created_at,
          updated_at: artifact.updated_at,
          ...deriveManifestIdentity(repo.repoRoot),
          artifacts: [{ ...artifact, size_bytes: artifact.size_bytes + 10 }],
        },
        null,
        2,
      ),
      "utf8",
    );

    const result = await validateManifest(repo.manifestPath, repo.artifactsDir);
    expect(result.ok).toBe(true);
    expect(result.warnings[0]).toContain("size_bytes");
  });

  it("accepts optional planning traceability fields", async () => {
    const repo = await createTempRepo();
    const artifact = await addArtifact(repo, {
      filename: "trace.md",
      content: "trace me",
    });

    await writeFile(
      repo.manifestPath,
      JSON.stringify(
        {
          version: 1,
          created_at: artifact.created_at,
          updated_at: artifact.updated_at,
          ...deriveManifestIdentity(repo.repoRoot),
          artifacts: [
            {
              ...artifact,
              status: "planned",
              related_changes: ["add-traceability"],
              derived_outputs: [".reffy/reffyspec/changes/add-traceability/proposal.md"],
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    const result = await validateManifest(repo.manifestPath, repo.artifactsDir);
    expect(result.ok).toBe(true);
  });

  it("fails when present identity fields are malformed", async () => {
    const repo = await createTempRepo();
    const now = new Date().toISOString();
    await writeFile(
      repo.manifestPath,
      JSON.stringify(
        {
          version: 1,
          created_at: now,
          updated_at: now,
          project_id: "Not Valid",
          workspace_ids: ["also invalid"],
          artifacts: [],
        },
        null,
        2,
      ),
      "utf8",
    );

    const result = await validateManifest(repo.manifestPath, repo.artifactsDir);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("project_id must be a non-empty kebab-case string");
    expect(result.errors.join("\n")).toContain("workspace_ids[0] must be a non-empty kebab-case string");
  });

  it("rejects empty or duplicate workspace_ids", async () => {
    const repo = await createTempRepo();
    const now = new Date().toISOString();
    await writeFile(
      repo.manifestPath,
      JSON.stringify(
        {
          version: 1,
          created_at: now,
          updated_at: now,
          project_id: "my-project",
          workspace_ids: ["my-project", "my-project"],
          artifacts: [],
        },
        null,
        2,
      ),
      "utf8",
    );

    const result = await validateManifest(repo.manifestPath, repo.artifactsDir);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain(`workspace_ids[1] duplicates "my-project"`);
  });

  it("warns when workspace_name is present without workspace_ids", async () => {
    const repo = await createTempRepo();
    const now = new Date().toISOString();
    await writeFile(
      repo.manifestPath,
      JSON.stringify(
        {
          version: 1,
          created_at: now,
          updated_at: now,
          project_id: "my-project",
          workspace_name: "my-project",
          artifacts: [],
        },
        null,
        2,
      ),
      "utf8",
    );

    const result = await validateManifest(repo.manifestPath, repo.artifactsDir);
    expect(result.ok).toBe(true);
    expect(result.warnings.join("\n")).toContain("workspace_name is deprecated");
  });

  it("migrates legacy workspace_name into workspace_ids via normalizeManifest", async () => {
    const repo = await createTempRepo();
    const now = new Date().toISOString();
    const raw = {
      version: 1,
      created_at: now,
      updated_at: now,
      project_id: "my-project",
      workspace_name: "My Project",
      artifacts: [],
    };

    const migrated = normalizeManifest(raw, repo.repoRoot);
    expect(migrated.project_id).toBe("my-project");
    expect(migrated.workspace_ids).toEqual(["my-project"]);
    expect(migrated.created_at).toBe(now);
    expect(migrated.updated_at).toBe(now);
  });

  it("preserves explicit workspace_ids over legacy workspace_name", async () => {
    const repo = await createTempRepo();
    const now = new Date().toISOString();
    const raw = {
      version: 1,
      created_at: now,
      updated_at: now,
      project_id: "my-project",
      workspace_ids: ["my-project", "portfolio-alpha"],
      workspace_name: "ignored",
      artifacts: [],
    };

    const migrated = normalizeManifest(raw, repo.repoRoot);
    expect(migrated.workspace_ids).toEqual(["my-project", "portfolio-alpha"]);
  });

  it("checks isManifest type guard", () => {
    expect(isManifest({ version: 1, artifacts: [], created_at: "x", updated_at: "y" })).toBe(true);
    expect(isManifest({ version: 2, artifacts: [] })).toBe(false);
    expect(isManifest(null)).toBe(false);
  });
});
