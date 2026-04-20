import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { collectWorkspaceDocuments, toCanonicalRemotePath, updateRemoteConfigMetadata, validateImportResult } from "../src/remote.js";
import { createTempRepo } from "./helpers.js";

describe("remote runtime", () => {
  it("converts workspace files to canonical .reffy paths", () => {
    const refsDir = path.join("/tmp", "repo", ".reffy");
    const filePath = path.join(refsDir, "artifacts", "idea.md");
    expect(toCanonicalRemotePath(refsDir, filePath)).toBe(".reffy/artifacts/idea.md");
  });

  it("collects workspace documents and excludes local state files", async () => {
    const repo = await createTempRepo();
    await writeFile(path.join(repo.refsDir, "AGENTS.md"), "# Reffy\n", "utf8");
    await writeFile(path.join(repo.artifactsDir, "idea.md"), "# Idea\n", "utf8");
    await mkdir(path.join(repo.refsDir, "state"), { recursive: true });
    await writeFile(
      path.join(repo.refsDir, "state", "remote.json"),
      JSON.stringify({ ignored: true }, null, 2),
      "utf8",
    );

    const documents = await collectWorkspaceDocuments(repo.repoRoot);
    const paths = documents.map((document) => document.path).sort();

    expect(paths).toContain(".reffy/manifest.json");
    expect(paths).toContain(".reffy/AGENTS.md");
    expect(paths).toContain(".reffy/artifacts/idea.md");
    expect(paths).not.toContain(".reffy/state/remote.json");
  });

  it("validates import responses contain all required counts", () => {
    expect(validateImportResult({ imported: 3, created: 2, updated: 1, deleted: 0 })).toEqual({
      imported: 3,
      created: 2,
      updated: 1,
      deleted: 0,
    });
    expect(() => validateImportResult({ imported: 3, created: 2 })).toThrow(
      "Remote import response missing numeric field(s): updated, deleted",
    );
  });

  it("updates local remote state metadata after import", async () => {
    const repo = await createTempRepo();
    await mkdir(path.join(repo.refsDir, "state"), { recursive: true });
    await writeFile(
      path.join(repo.refsDir, "state", "remote.json"),
      JSON.stringify(
        {
          version: 1,
          provider: "paseo",
          endpoint: "https://example.invalid",
          pod_name: "pod-123",
          actor_id: "actor-456",
        },
        null,
        2,
      ),
      "utf8",
    );

    const updated = await updateRemoteConfigMetadata(repo.repoRoot, {
      last_imported_at: "2026-04-20T00:00:00.000Z",
    });
    expect(updated?.last_imported_at).toBe("2026-04-20T00:00:00.000Z");
  });
});
