import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveRefsDir } from "./refs-paths.js";
import type { RemoteDocument, RemoteImportResult, RemoteLinkConfig, RemoteWorkspaceSummary } from "./types.js";

export const REMOTE_CONFIG_VERSION = 1;
export const REMOTE_PROVIDER = "paseo";
const REMOTE_STATE_DIR = path.join("state");
const REMOTE_CONFIG_FILE = "remote.json";

export interface WorkspaceIdentity {
  project_id: string;
  workspace_name: string;
}

export interface EnsureRemoteInitOptions {
  endpoint: string;
  podName?: string;
  actorId?: string;
  provision: boolean;
  identity: WorkspaceIdentity;
}

export interface EnsureRemoteInitResult {
  config: RemoteLinkConfig;
  created_pod: boolean;
  created_actor: boolean;
}

export interface ValidatedImportResult {
  imported: number;
  created: number;
  updated: number;
  deleted: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeSeparators(value: string): string {
  return value.split(path.sep).join("/");
}

export function resolveRemoteConfigPath(repoRoot: string): string {
  return path.join(resolveRefsDir(repoRoot), REMOTE_STATE_DIR, REMOTE_CONFIG_FILE);
}

export async function readRemoteConfig(repoRoot: string): Promise<RemoteLinkConfig | null> {
  const configPath = resolveRemoteConfigPath(repoRoot);
  const raw = await fs.readFile(configPath, "utf8").catch(() => null);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(
      `Failed to parse remote config at ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!isObject(parsed)) {
    throw new Error(`Remote config at ${configPath} must be an object`);
  }
  if (parsed.version !== REMOTE_CONFIG_VERSION) {
    throw new Error(`Remote config at ${configPath} must use version ${String(REMOTE_CONFIG_VERSION)}`);
  }
  if (parsed.provider !== REMOTE_PROVIDER) {
    throw new Error(`Remote config at ${configPath} must use provider "${REMOTE_PROVIDER}"`);
  }
  if (!isNonEmptyString(parsed.endpoint)) {
    throw new Error(`Remote config at ${configPath} must define endpoint`);
  }
  if (!isNonEmptyString(parsed.pod_name)) {
    throw new Error(`Remote config at ${configPath} must define pod_name`);
  }
  if (!isNonEmptyString(parsed.actor_id)) {
    throw new Error(`Remote config at ${configPath} must define actor_id`);
  }

  return {
    version: REMOTE_CONFIG_VERSION,
    provider: REMOTE_PROVIDER,
    endpoint: parsed.endpoint.trim(),
    pod_name: parsed.pod_name.trim(),
    actor_id: parsed.actor_id.trim(),
    last_imported_at: isNonEmptyString(parsed.last_imported_at) ? parsed.last_imported_at.trim() : undefined,
  };
}

export async function writeRemoteConfig(repoRoot: string, config: RemoteLinkConfig): Promise<string> {
  const configPath = resolveRemoteConfigPath(repoRoot);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
  return configPath;
}

export async function updateRemoteConfigMetadata(
  repoRoot: string,
  patch: Partial<Pick<RemoteLinkConfig, "last_imported_at">>,
): Promise<RemoteLinkConfig | null> {
  const existing = await readRemoteConfig(repoRoot);
  if (!existing) return null;
  const next: RemoteLinkConfig = {
    ...existing,
    ...patch,
  };
  await writeRemoteConfig(repoRoot, next);
  return next;
}

export function mergeRemoteConfig(
  stored: RemoteLinkConfig | null,
  overrides: Partial<Pick<RemoteLinkConfig, "endpoint" | "pod_name" | "actor_id">>,
): RemoteLinkConfig | null {
  if (!stored && !overrides.endpoint && !overrides.pod_name && !overrides.actor_id) {
    return null;
  }

  const endpoint = overrides.endpoint ?? stored?.endpoint;
  const pod_name = overrides.pod_name ?? stored?.pod_name;
  const actor_id = overrides.actor_id ?? stored?.actor_id;
  if (!endpoint || !pod_name || !actor_id) {
    return null;
  }

  return {
    version: REMOTE_CONFIG_VERSION,
    provider: REMOTE_PROVIDER,
    endpoint,
    pod_name,
    actor_id,
    last_imported_at: stored?.last_imported_at,
  };
}

export function describeRemoteLinkage(config: Pick<RemoteLinkConfig, "endpoint" | "pod_name" | "actor_id">): string {
  return `endpoint=${config.endpoint} pod=${config.pod_name} actor=${config.actor_id}`;
}

async function http(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText} - ${text}`);
  }

  return response;
}

async function httpJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await http(url, init);
  return (await response.json()) as T;
}

function actorBase(config: Pick<RemoteLinkConfig, "endpoint" | "pod_name" | "actor_id">): string {
  return `${config.endpoint}/pods/${config.pod_name}/actors/${config.actor_id}`;
}

export class PaseoRemoteClient {
  private readonly config: Pick<RemoteLinkConfig, "endpoint" | "pod_name" | "actor_id">;

  constructor(config: Pick<RemoteLinkConfig, "endpoint" | "pod_name" | "actor_id">) {
    this.config = config;
  }

  async createPod(): Promise<string> {
    const result = await httpJson<{ podName: string }>(`${this.config.endpoint}/pods`, { method: "POST" });
    if (!isNonEmptyString(result.podName)) {
      throw new Error("Paseo create pod response missing podName");
    }
    return result.podName.trim();
  }

  async createActor(identity: WorkspaceIdentity): Promise<string> {
    const result = await httpJson<{ actorId: string }>(
      `${this.config.endpoint}/pods/${this.config.pod_name}/actors`,
      {
        method: "POST",
        body: JSON.stringify({
          config: {
            actorType: "reffyRemoteBackend",
            version: "v1",
            schema: { type: "object" },
            params: {
              project_id: identity.project_id,
              workspace_name: identity.workspace_name,
              default_lock_ttl_seconds: 120,
              max_snapshot_documents: 1000,
            },
          },
        }),
      },
    );
    if (!isNonEmptyString(result.actorId)) {
      throw new Error("Paseo create actor response missing actorId");
    }
    return result.actorId.trim();
  }

  async getWorkspace(): Promise<RemoteWorkspaceSummary> {
    return await httpJson<RemoteWorkspaceSummary>(`${actorBase(this.config)}/workspace`);
  }

  async importWorkspace(documents: RemoteDocument[], replaceMissing = true): Promise<RemoteImportResult> {
    return await httpJson<RemoteImportResult>(`${actorBase(this.config)}/workspace/import`, {
      method: "POST",
      body: JSON.stringify({
        documents,
        replace_missing: replaceMissing,
      }),
    });
  }

  async getSnapshot(prefix?: string): Promise<{ documents?: Array<{ path?: string }> }> {
    const query = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
    return await httpJson<{ documents?: Array<{ path?: string }> }>(`${actorBase(this.config)}/workspace/snapshot${query}`);
  }

  async getDocument(documentPath: string): Promise<{ document?: { path?: string; content?: string; content_type?: string } }> {
    return await httpJson<{ document?: { path?: string; content?: string; content_type?: string } }>(
      `${actorBase(this.config)}/workspace/documents?path=${encodeURIComponent(documentPath)}`,
    );
  }
}

export async function ensureRemoteInit(
  repoRoot: string,
  options: EnsureRemoteInitOptions,
): Promise<EnsureRemoteInitResult> {
  let created_pod = false;
  let created_actor = false;
  let podName = options.podName?.trim() || "";
  let actorId = options.actorId?.trim() || "";

  if (!options.endpoint.trim()) {
    throw new Error("Remote init requires an endpoint");
  }

  if (!podName && !options.provision) {
    throw new Error("Remote init requires --pod-name unless --provision is set");
  }

  const baseClient = new PaseoRemoteClient({
    endpoint: options.endpoint.trim(),
    pod_name: podName || "pending-pod",
    actor_id: actorId || "pending-actor",
  });

  if (!podName) {
    podName = await baseClient.createPod();
    created_pod = true;
  }

  if (!actorId) {
    if (!options.provision) {
      throw new Error("Remote init requires --actor-id unless --provision is set");
    }
    const client = new PaseoRemoteClient({
      endpoint: options.endpoint.trim(),
      pod_name: podName,
      actor_id: "pending-actor",
    });
    actorId = await client.createActor(options.identity);
    created_actor = true;
  }

  const config: RemoteLinkConfig = {
    version: REMOTE_CONFIG_VERSION,
    provider: REMOTE_PROVIDER,
    endpoint: options.endpoint.trim(),
    pod_name: podName,
    actor_id: actorId,
  };

  await writeRemoteConfig(repoRoot, config);
  return { config, created_pod, created_actor };
}

export function requireWorkspaceIdentity(identity: {
  project_id?: string;
  workspace_name?: string;
}): WorkspaceIdentity {
  const project_id = identity.project_id?.trim();
  const workspace_name = identity.workspace_name?.trim();
  if (!project_id || !workspace_name) {
    throw new Error("Remote sync requires .reffy/manifest.json to define project_id and workspace_name");
  }
  return { project_id, workspace_name };
}

export function extractWorkspaceIdentity(summary: RemoteWorkspaceSummary): {
  project_id?: string | null;
  workspace_name?: string | null;
  document_count?: number | null;
} {
  const workspace = isObject(summary.workspace) ? summary.workspace : {};
  const stats = isObject(summary.stats) ? summary.stats : {};
  return {
    project_id: typeof workspace.project_id === "string" ? workspace.project_id : null,
    workspace_name: typeof workspace.workspace_name === "string" ? workspace.workspace_name : null,
    document_count: typeof stats.document_count === "number" ? stats.document_count : null,
  };
}

export function assertRemoteIdentity(summary: RemoteWorkspaceSummary, identity: WorkspaceIdentity): void {
  const remote = extractWorkspaceIdentity(summary);
  if (remote.project_id !== identity.project_id || remote.workspace_name !== identity.workspace_name) {
    throw new Error(
      `Remote identity mismatch: local=${identity.project_id}/${identity.workspace_name} remote=${String(remote.project_id)}/${String(remote.workspace_name)}`,
    );
  }
}

export function validateImportResult(result: RemoteImportResult): ValidatedImportResult {
  const requiredKeys = ["imported", "created", "updated", "deleted"] as const;
  const missing = requiredKeys.filter((key) => typeof result[key] !== "number");
  if (missing.length > 0) {
    throw new Error(`Remote import response missing numeric field(s): ${missing.join(", ")}`);
  }

  return {
    imported: result.imported as number,
    created: result.created as number,
    updated: result.updated as number,
    deleted: result.deleted as number,
  };
}

async function collectFiles(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "state") continue;
      files.push(...(await collectFiles(fullPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function inferContentType(filePath: string): string {
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".md")) return "text/markdown";
  return "text/plain";
}

export function toCanonicalRemotePath(refsDir: string, filePath: string): string {
  const relative = normalizeSeparators(path.relative(refsDir, filePath));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Cannot convert ${filePath} into a canonical .reffy path`);
  }
  return `.reffy/${relative}`;
}

export async function collectWorkspaceDocuments(repoRoot: string): Promise<RemoteDocument[]> {
  const refsDir = resolveRefsDir(repoRoot);
  const stat = await fs.stat(refsDir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Reffy directory not found: ${refsDir}`);
  }

  const files = await collectFiles(refsDir);
  const documents: RemoteDocument[] = [];
  for (const fullPath of files.sort()) {
    const content = await fs.readFile(fullPath, "utf8");
    const remotePath = toCanonicalRemotePath(refsDir, fullPath);
    documents.push({
      path: remotePath,
      content,
      content_type: inferContentType(remotePath),
      metadata: {
        source: "local-reffy-import",
        size_bytes: Buffer.byteLength(content, "utf8"),
      },
    });
  }

  return documents;
}
