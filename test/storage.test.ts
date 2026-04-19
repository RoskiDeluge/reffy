import { rm, utimes, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { deriveManifestIdentity } from "../src/manifest.js";
import { ReferencesStore } from "../src/storage.js";
import { createTempRepo } from "./helpers.js";

describe("ReferencesStore", () => {
  it("exposes manifest-backed workspace identity", async () => {
    const repo = await createTempRepo();
    const store = new ReferencesStore(repo.repoRoot);

    await expect(store.getWorkspaceIdentity()).resolves.toEqual({
      project_id: deriveManifestIdentity(repo.repoRoot).project_id,
      workspace_name: deriveManifestIdentity(repo.repoRoot).workspace_name,
    });
  });

  it("creates, updates, and deletes artifacts", async () => {
    const repo = await createTempRepo();
    const store = new ReferencesStore(repo.repoRoot);

    const created = await store.createArtifact({
      name: "Test Artifact",
      content: "hello",
    });

    expect(created.filename).toMatch(/test-artifact/);
    expect((await store.listArtifacts()).length).toBeGreaterThanOrEqual(1);
    expect(await store.getArtifact(created.id)).not.toBeNull();

    const updated = await store.updateArtifact(created.id, {
      name: "Renamed",
      content: "updated content",
      tags: ["x"],
    });

    expect(updated?.name).toBe("Renamed");
    expect(updated?.tags).toEqual(["x"]);

    const deleted = await store.deleteArtifact(created.id);
    expect(deleted).toBe(true);
    expect(await store.getArtifact(created.id)).toBeNull();
  });

  it("reindexes artifacts that exist on disk but not in manifest", async () => {
    const repo = await createTempRepo();
    const store = new ReferencesStore(repo.repoRoot);

    await writeFile(path.join(store.artifactsDir, "new-note.md"), "note", "utf8");
    const result = await store.reindexArtifacts();

    expect(result.added).toBe(1);
    const artifacts = await store.listArtifacts();
    expect(artifacts.some((a) => a.filename === "new-note.md")).toBe(true);
  });

  it("removes manifest entries for files deleted from artifacts directory", async () => {
    const repo = await createTempRepo();
    const store = new ReferencesStore(repo.repoRoot);

    const created = await store.createArtifact({
      name: "to delete",
      content: "remove me",
    });
    await rm(path.join(store.artifactsDir, created.filename), { force: true });

    const result = await store.reindexArtifacts();
    expect(result.removed).toBe(1);
    expect(result.total).toBe(0);
    expect(await store.getArtifact(created.id)).toBeNull();
  });

  it("updates artifact updated_at during reindex when file content changes on disk", async () => {
    const repo = await createTempRepo();
    const store = new ReferencesStore(repo.repoRoot);

    await writeFile(path.join(store.artifactsDir, "tracked-note.md"), "first", "utf8");
    await store.reindexArtifacts();
    const before = (await store.listArtifacts()).find((artifact) => artifact.filename === "tracked-note.md");
    expect(before).toBeDefined();

    const filePath = path.join(store.artifactsDir, "tracked-note.md");
    await writeFile(filePath, "second update with different size", "utf8");
    const future = new Date(Date.now() + 5_000);
    await utimes(filePath, future, future);

    await store.reindexArtifacts();
    const after = (await store.listArtifacts()).find((artifact) => artifact.filename === "tracked-note.md");
    expect(after).toBeDefined();
    expect(after?.created_at).toBe(before?.created_at);
    expect(Date.parse(after?.updated_at ?? "")).toBeGreaterThan(Date.parse(before?.updated_at ?? ""));
    expect(after?.updated_at).not.toBe(before?.updated_at);
  });

  it("validates manifest through store facade", async () => {
    const repo = await createTempRepo();
    const store = new ReferencesStore(repo.repoRoot);
    const result = await store.validateManifest();
    expect(result.ok).toBe(true);
  });

  it("records planning outputs against selected artifacts", async () => {
    const repo = await createTempRepo();
    const store = new ReferencesStore(repo.repoRoot);
    const created = await store.createArtifact({
      name: "Planning Input",
      content: "context",
    });

    const result = await store.linkPlanningOutputs(
      [created.filename],
      [".reffy/reffyspec/changes/add-demo/proposal.md", ".reffy/reffyspec/changes/add-demo/tasks.md"],
      "add-demo",
    );

    expect(result.linked).toBe(1);
    const updated = await store.getArtifact(created.id);
    expect(updated?.related_changes).toContain("add-demo");
    expect(updated?.derived_outputs).toContain(".reffy/reffyspec/changes/add-demo/proposal.md");
  });
});
