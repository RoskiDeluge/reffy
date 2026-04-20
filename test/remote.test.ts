import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { collectWorkspaceDocuments, toCanonicalRemotePath } from "../src/remote.js";
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
});
