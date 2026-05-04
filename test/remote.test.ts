import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  assertWorkspaceSummaryIdentity,
  collectWorkspaceDocuments,
  ensureWorkspaceTarget,
  extractWorkspaceSummaryIdentity,
  PaseoManagerClient,
  PaseoWorkspaceBackendClient,
  readRemoteConfig,
  resolveSelectedWorkspaceId,
  toCanonicalRemotePath,
  updateRemoteConfigMetadata,
  validateImportResult,
  writeRemoteConfig,
} from "../src/remote.js";
import type { RemoteLinkConfig } from "../src/types.js";
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
          version: 4,
          provider: "paseo",
          manager: { pod_name: "pod-mgr", actor_id: "actor-mgr" },
          targets: {
            "portfolio-alpha": {
              workspace_backend: { pod_name: "pod-123", actor_id: "actor-456" },
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
    expect(updated?.targets["portfolio-alpha"].workspace_backend).toEqual({
      pod_name: "pod-123",
      actor_id: "actor-456",
    });
    expect(updated?.manager).toEqual({ pod_name: "pod-mgr", actor_id: "actor-mgr" });
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

  it("extracts workspace identity and stats from v2 backend summary envelopes", () => {
    const summary = {
      source: { actor_type: "reffyRemoteBackend", version: "v2" },
      workspace: { workspace_id: "portfolio-alpha" },
      stats: { document_count: 42, registered_project_count: 3 },
    };
    expect(extractWorkspaceSummaryIdentity(summary)).toEqual({
      workspace_id: "portfolio-alpha",
      actor_type: "reffyRemoteBackend",
      backend_version: "v2",
      document_count: 42,
      registered_project_count: 3,
    });
  });

  it("surfaces reinitialization guidance when the backend response lacks workspace identity", () => {
    const legacyLikeSummary = { workspace: { workspace_name: "some-ws" } };
    expect(() =>
      assertWorkspaceSummaryIdentity(legacyLikeSummary, "w"),
    ).toThrow(/Reinitialize against reffyWorkspaceManager\.v1 \+ reffyRemoteBackend\.v2/);
  });

  it("fails on workspace identity mismatch between expected and remote envelopes", () => {
    const summary = { workspace: { workspace_id: "other" } };
    expect(() => assertWorkspaceSummaryIdentity(summary, "expected")).toThrow(
      /Remote identity mismatch: expected workspace_id=expected/,
    );
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

  it("rejects legacy v2 combined-backend remote.json with manager-aware reinitialization guidance", async () => {
    const repo = await createTempRepo();
    await mkdir(path.join(repo.refsDir, "state"), { recursive: true });
    await writeFile(
      path.join(repo.refsDir, "state", "remote.json"),
      JSON.stringify(
        {
          version: 2,
          provider: "paseo",
          endpoint: "https://example.invalid",
          targets: { "portfolio-alpha": { pod_name: "pod-123", actor_id: "actor-456" } },
        },
        null,
        2,
      ),
      "utf8",
    );

    const { readRemoteConfig: read } = await import("../src/remote.js");
    await expect(read(repo.repoRoot)).rejects.toThrow(/legacy v2 combined-backend shape/);
  });

  it("rejects legacy v3 endpoint-bearing remote.json with bearer-token reinitialization guidance", async () => {
    const repo = await createTempRepo();
    await mkdir(path.join(repo.refsDir, "state"), { recursive: true });
    await writeFile(
      path.join(repo.refsDir, "state", "remote.json"),
      JSON.stringify(
        {
          version: 3,
          provider: "paseo",
          endpoint: "https://example.invalid",
          manager: { pod_name: "pod-mgr", actor_id: "actor-mgr" },
          targets: {
            "portfolio-alpha": {
              workspace_backend: { pod_name: "pod-ws", actor_id: "actor-ws" },
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const { readRemoteConfig: read } = await import("../src/remote.js");
    await expect(read(repo.repoRoot)).rejects.toThrow(/legacy v3 shape/);
  });
});

describe("manager + workspace backend clients", () => {
  function makeFakeFetch(
    handler: (url: string, init: RequestInit | undefined) => { status?: number; body: unknown },
  ): typeof fetch {
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const { status = 200, body } = handler(url, init);
      const text = typeof body === "string" ? body : JSON.stringify(body);
      return new Response(text, {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
  }

  it("manager createWorkspace sends Authorization: Bearer and returns workspace_backend identity", async () => {
    const seenAuth: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = makeFakeFetch((url, init) => {
      expect(url).toMatch(/\/pods\/pod-mgr\/actors\/actor-mgr\/workspaces$/);
      const headers = new Headers(init?.headers ?? {});
      const auth = headers.get("Authorization") ?? "";
      seenAuth.push(auth);
      return {
        body: { workspace: { workspace_id: "ws-a", backend: { pod_name: "pod-ws", actor_id: "actor-ws" } } },
      };
    });
    try {
      const manager = new PaseoManagerClient(
        "https://paseo.example",
        { pod_name: "pod-mgr", actor_id: "actor-mgr" },
        "test-token",
      );
      const backend = await manager.createWorkspace("ws-a", { label: "WS A" });
      expect(backend).toEqual({ pod_name: "pod-ws", actor_id: "actor-ws" });
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(seenAuth).toEqual(["Bearer test-token"]);
  });

  it("manager methods refuse to call without a token", async () => {
    const manager = new PaseoManagerClient(
      "https://paseo.example",
      { pod_name: "pod-mgr", actor_id: "actor-mgr" },
    );
    await expect(manager.getWorkspace("ws-a")).rejects.toThrow(/PASEO_TOKEN/);
  });

  it("401 from any Paseo route surfaces as a RemoteHttpError with status 401", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = makeFakeFetch(() => ({ status: 401, body: "unauthorized" }));
    try {
      const manager = new PaseoManagerClient(
        "https://paseo.example",
        { pod_name: "pod-mgr", actor_id: "actor-mgr" },
        "stale-token",
      );
      await expect(manager.getWorkspace("ws-a")).rejects.toMatchObject({ status: 401 });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("manager registerProject treats 409 as already_registered", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = makeFakeFetch(() => ({ status: 409, body: "project already registered" }));
    try {
      const manager = new PaseoManagerClient(
        "https://paseo.example",
        { pod_name: "pod-mgr", actor_id: "actor-mgr" },
        "test-token",
      );
      const result = await manager.registerProject("ws-a", "proj-1");
      expect(result).toEqual({ alreadyRegistered: true });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("ensureWorkspaceTarget recovers from 409 on create by resolving through the manager", async () => {
    const repo = await createTempRepo();
    const initial: RemoteLinkConfig = {
      version: 4,
      provider: "paseo",
      manager: { pod_name: "pod-mgr", actor_id: "actor-mgr" },
      targets: {},
    };
    await mkdir(path.join(repo.refsDir, "state"), { recursive: true });
    await writeRemoteConfig(repo.repoRoot, initial);

    const calls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = makeFakeFetch((url, init) => {
      const method = init?.method ?? "GET";
      calls.push(`${method} ${url}`);
      if (method === "POST" && url.endsWith("/workspaces")) {
        return { status: 409, body: "workspace exists" };
      }
      if (method === "GET" && url.endsWith("/workspaces/ws-a")) {
        return {
          body: { workspace: { workspace_id: "ws-a", backend: { pod_name: "pod-ws", actor_id: "actor-ws" } } },
        };
      }
      return { status: 500, body: "unexpected" };
    });
    try {
      const result = await ensureWorkspaceTarget(repo.repoRoot, initial, {
        workspaceId: "ws-a",
        mode: "create",
        endpoint: "https://paseo.example",
        token: "test-token",
      });
      expect(result.outcome).toBe("resolved");
      expect(result.workspace_backend).toEqual({ pod_name: "pod-ws", actor_id: "actor-ws" });
      const persisted = await readRemoteConfig(repo.repoRoot);
      expect(persisted?.targets["ws-a"].workspace_backend).toEqual({
        pod_name: "pod-ws",
        actor_id: "actor-ws",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(calls.some((c) => c.startsWith("POST"))).toBe(true);
    expect(calls.some((c) => c.startsWith("GET"))).toBe(true);
  });

  it("manager deleteWorkspace returns alreadyAbsent on 404 and propagates other errors", async () => {
    const originalFetch = globalThis.fetch;
    let mode: "ok" | "missing" | "error" = "ok";
    globalThis.fetch = makeFakeFetch(() => {
      if (mode === "ok") return { status: 200, body: { ok: true } };
      if (mode === "missing") return { status: 404, body: "workspace not found" };
      return { status: 500, body: "boom" };
    });
    try {
      const manager = new PaseoManagerClient(
        "https://paseo.example",
        { pod_name: "pod-mgr", actor_id: "actor-mgr" },
        "test-token",
      );

      mode = "ok";
      await expect(manager.deleteWorkspace("ws-a")).resolves.toEqual({ alreadyAbsent: false });

      mode = "missing";
      await expect(manager.deleteWorkspace("ws-a")).resolves.toEqual({ alreadyAbsent: true });

      mode = "error";
      await expect(manager.deleteWorkspace("ws-a")).rejects.toThrow(/500/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("removeWorkspaceTarget drops the entry from local linkage and reports prior presence", async () => {
    const repo = await createTempRepo();
    const initial: RemoteLinkConfig = {
      version: 4,
      provider: "paseo",
      manager: { pod_name: "pod-mgr", actor_id: "actor-mgr" },
      targets: {
        keep: { workspace_backend: { pod_name: "pod-1", actor_id: "actor-1" } },
        drop: { workspace_backend: { pod_name: "pod-2", actor_id: "actor-2" } },
      },
    };
    await mkdir(path.join(repo.refsDir, "state"), { recursive: true });
    await writeRemoteConfig(repo.repoRoot, initial);

    const { removeWorkspaceTarget } = await import("../src/remote.js");
    const result = await removeWorkspaceTarget(repo.repoRoot, initial, "drop");
    expect(result.existed).toBe(true);
    expect(Object.keys(result.config.targets)).toEqual(["keep"]);

    const reread = await readRemoteConfig(repo.repoRoot);
    expect(reread?.targets).not.toHaveProperty("drop");

    const noop = await removeWorkspaceTarget(repo.repoRoot, result.config, "missing");
    expect(noop.existed).toBe(false);
  });

  it("workspace backend importProject sends Authorization header and hits /workspace/projects/{project_id}/import", async () => {
    const seenUrls: string[] = [];
    const seenAuth: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = makeFakeFetch((url, init) => {
      seenUrls.push(url);
      const headers = new Headers(init?.headers ?? {});
      seenAuth.push(headers.get("Authorization") ?? "");
      return { body: { imported: 1, created: 1, updated: 0, deleted: 0 } };
    });
    try {
      const client = new PaseoWorkspaceBackendClient(
        "https://paseo.example",
        { pod_name: "pod-ws", actor_id: "actor-ws" },
        "test-token",
      );
      await client.importProject("proj-1", [
        { path: ".reffy/manifest.json", content: "{}", content_type: "application/json" },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(seenUrls[0]).toBe(
      "https://paseo.example/pods/pod-ws/actors/actor-ws/workspace/projects/proj-1/import",
    );
    expect(seenAuth).toEqual(["Bearer test-token"]);
  });

  it("workspace backend client constructor refuses an empty token", () => {
    expect(
      () =>
        new PaseoWorkspaceBackendClient(
          "https://paseo.example",
          { pod_name: "pod-ws", actor_id: "actor-ws" },
          "",
        ),
    ).toThrow(/PASEO_TOKEN/);
  });
});
