import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  assertRemoteIdentity,
  collectWorkspaceDocuments,
  extractWorkspaceIdentity,
  resolveSelectedWorkspaceId,
  toCanonicalRemotePath,
  updateRemoteConfigMetadata,
  validateImportResult,
} from "../src/remote.js";
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

  it("updates local remote state metadata after import for the selected workspace target", async () => {
    const repo = await createTempRepo();
    await mkdir(path.join(repo.refsDir, "state"), { recursive: true });
    await writeFile(
      path.join(repo.refsDir, "state", "remote.json"),
      JSON.stringify(
        {
          version: 2,
          provider: "paseo",
          endpoint: "https://example.invalid",
          targets: {
            "portfolio-alpha": {
              pod_name: "pod-123",
              actor_id: "actor-456",
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const updated = await updateRemoteConfigMetadata(repo.repoRoot, "portfolio-alpha", {
      last_imported_at: "2026-04-20T00:00:00.000Z",
    });
    expect(updated?.targets["portfolio-alpha"].last_imported_at).toBe("2026-04-20T00:00:00.000Z");
  });

  it("resolves a workspace id when the manifest has exactly one", () => {
    expect(resolveSelectedWorkspaceId({ workspace_ids: ["solo"] }, undefined)).toBe("solo");
  });

  it("requires --workspace-id when multiple memberships are configured", () => {
    expect(() =>
      resolveSelectedWorkspaceId({ workspace_ids: ["a", "b"] }, undefined),
    ).toThrow(/pass --workspace-id/);
  });

  it("rejects a workspace-id override that is not in the manifest membership", () => {
    expect(() => resolveSelectedWorkspaceId({ workspace_ids: ["a"] }, "b")).toThrow(
      /not a member of manifest.workspace_ids/,
    );
  });

  it("publishes newly introduced planning directories through collectWorkspaceDocuments", async () => {
    const repo = await createTempRepo();
    const planningDir = path.join(repo.refsDir, "reffyspec", "changes", "refactor", "specs", "membership");
    await mkdir(planningDir, { recursive: true });
    await writeFile(path.join(planningDir, "spec.md"), "# spec\n", "utf8");
    await writeFile(path.join(repo.refsDir, "reffyspec", "changes", "refactor", "proposal.md"), "# prop\n", "utf8");

    const documents = await collectWorkspaceDocuments(repo.repoRoot);
    const paths = documents.map((document) => document.path);
    expect(paths).toContain(".reffy/reffyspec/changes/refactor/proposal.md");
    expect(paths).toContain(".reffy/reffyspec/changes/refactor/specs/membership/spec.md");
  });

  it("extracts source plus workspace identity from v2 response envelopes", () => {
    const summary = {
      source: { actor_type: "reffyRemoteBackend", version: "v2", project_id: "my-project" },
      workspace: { workspace_id: "portfolio-alpha" },
      stats: { document_count: 42 },
    };
    expect(extractWorkspaceIdentity(summary)).toEqual({
      project_id: "my-project",
      workspace_id: "portfolio-alpha",
      actor_type: "reffyRemoteBackend",
      backend_version: "v2",
      document_count: 42,
    });
  });

  it("surfaces reinitialization guidance when the backend response lacks workspace identity", () => {
    const legacyLikeSummary = { workspace: { workspace_name: "some-ws" } };
    expect(() =>
      assertRemoteIdentity(legacyLikeSummary, { project_id: "p", workspace_id: "w" }),
    ).toThrow(/Reinitialize the target against reffyRemoteBackend\.v2/);
  });

  it("fails on identity mismatch between local and remote envelopes", () => {
    const summary = {
      source: { project_id: "other" },
      workspace: { workspace_id: "w" },
    };
    expect(() =>
      assertRemoteIdentity(summary, { project_id: "p", workspace_id: "w" }),
    ).toThrow(/Remote identity mismatch/);
  });

  it("rejects legacy v1 single-target remote.json with reinitialization guidance", async () => {
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

    const { readRemoteConfig } = await import("../src/remote.js");
    await expect(readRemoteConfig(repo.repoRoot)).rejects.toThrow(/legacy v1 single-target shape/);
  });
});
