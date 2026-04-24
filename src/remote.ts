import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveRefsDir } from "./refs-paths.js";
import type {
  RemoteDocument,
  RemoteImportResult,
  RemoteLinkConfig,
  RemoteTarget,
  RemoteWorkspaceSummary,
} from "./types.js";

export const REMOTE_CONFIG_VERSION = 2;
export const REMOTE_PROVIDER = "paseo";
export const REMOTE_BACKEND_ACTOR_TYPE = "reffyRemoteBackend";
export const REMOTE_BACKEND_VERSION = "v2";
const REMOTE_STATE_DIR = path.join("state");
const REMOTE_CONFIG_FILE = "remote.json";

export interface WorkspaceIdentity {
  project_id: string;
  workspace_id: string;
}

export interface ManifestIdentityLike {
  project_id?: string;
  workspace_ids?: string[];
}

export interface ResolvedRemoteTarget {
  endpoint: string;
  pod_name: string;
  actor_id: string;
  last_imported_at?: string;
}

export interface EnsureRemoteInitOptions {
  endpoint: string;
  podName?: string;
  actorId?: string;
  provision: boolean;
  identity: WorkspaceIdentity;
  existingConfig: RemoteLinkConfig | null;
}

export interface EnsureRemoteInitResult {
  config: RemoteLinkConfig;
  target: RemoteTarget;
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

export function resolveSelectedWorkspaceId(
  identity: ManifestIdentityLike,
  override: string | undefined,
): string {
  const workspaceIds = (identity.workspace_ids ?? [])
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (override !== undefined) {
    const trimmed = override.trim();
    if (!trimmed) {
      throw new Error("--workspace-id requires a non-empty value");
    }
    if (workspaceIds.length > 0 && !workspaceIds.includes(trimmed)) {
      throw new Error(
        `Selected workspace id "${trimmed}" is not a member of manifest.workspace_ids: ${workspaceIds.join(", ") || "(none)"}`,
      );
    }
    return trimmed;
  }

  if (workspaceIds.length === 0) {
    throw new Error(
      "Remote sync requires .reffy/manifest.json to define workspace_ids. Run `reffy init` or add at least one workspace id.",
    );
  }

  if (workspaceIds.length === 1) {
    return workspaceIds[0];
  }

  throw new Error(
    `Manifest has multiple workspace_ids (${workspaceIds.join(", ")}); pass --workspace-id to select a target projection.`,
  );
}

export function requireWorkspaceIdentity(
  identity: ManifestIdentityLike,
  selectedWorkspaceId: string,
): WorkspaceIdentity {
  const project_id = identity.project_id?.trim();
  if (!project_id) {
    throw new Error("Remote sync requires .reffy/manifest.json to define project_id");
  }
  const workspace_id = selectedWorkspaceId.trim();
  if (!workspace_id) {
    throw new Error("Remote sync requires a selected workspace_id");
  }
  return { project_id, workspace_id };
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
  if (parsed.provider !== REMOTE_PROVIDER) {
    throw new Error(`Remote config at ${configPath} must use provider "${REMOTE_PROVIDER}"`);
  }
  if (!isNonEmptyString(parsed.endpoint)) {
    throw new Error(`Remote config at ${configPath} must define endpoint`);
  }

  if (parsed.version === 1) {
    throw new Error(
      `Remote config at ${configPath} uses the legacy v1 single-target shape. Run \`reffy remote init --provision\` against the v2 backend to reinitialize, then repush with \`reffy remote push\`.`,
    );
  }

  if (parsed.version !== REMOTE_CONFIG_VERSION) {
    throw new Error(
      `Remote config at ${configPath} must use version ${String(REMOTE_CONFIG_VERSION)}`,
    );
  }

  if (!isObject(parsed.targets)) {
    throw new Error(`Remote config at ${configPath} must define targets as an object keyed by workspace_id`);
  }

  const targets: Record<string, RemoteTarget> = {};
  for (const [workspaceId, entry] of Object.entries(parsed.targets)) {
    if (!isObject(entry)) {
      throw new Error(`Remote config at ${configPath} has invalid target for workspace_id "${workspaceId}"`);
    }
    if (!isNonEmptyString(entry.pod_name)) {
      throw new Error(`Remote config target "${workspaceId}" must define pod_name`);
    }
    if (!isNonEmptyString(entry.actor_id)) {
      throw new Error(`Remote config target "${workspaceId}" must define actor_id`);
    }
    targets[workspaceId] = {
      pod_name: entry.pod_name.trim(),
      actor_id: entry.actor_id.trim(),
      last_imported_at: isNonEmptyString(entry.last_imported_at) ? entry.last_imported_at.trim() : undefined,
    };
  }

  return {
    version: REMOTE_CONFIG_VERSION,
    provider: REMOTE_PROVIDER,
    endpoint: parsed.endpoint.trim(),
    targets,
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
  workspaceId: string,
  patch: Partial<Pick<RemoteTarget, "last_imported_at">>,
): Promise<RemoteLinkConfig | null> {
  const existing = await readRemoteConfig(repoRoot);
  if (!existing) return null;
  const target = existing.targets[workspaceId];
  if (!target) return null;
  const next: RemoteLinkConfig = {
    ...existing,
    targets: {
      ...existing.targets,
      [workspaceId]: { ...target, ...patch },
    },
  };
  await writeRemoteConfig(repoRoot, next);
  return next;
}

export function resolveRemoteTarget(
  stored: RemoteLinkConfig | null,
  workspaceId: string,
  overrides: { endpoint?: string; pod_name?: string; actor_id?: string },
): ResolvedRemoteTarget | null {
  const endpoint = overrides.endpoint ?? stored?.endpoint;
  const target = stored?.targets?.[workspaceId];
  const pod_name = overrides.pod_name ?? target?.pod_name;
  const actor_id = overrides.actor_id ?? target?.actor_id;
  if (!endpoint || !pod_name || !actor_id) {
    return null;
  }
  return {
    endpoint,
    pod_name,
    actor_id,
    last_imported_at: target?.last_imported_at,
  };
}

export function describeRemoteLinkage(linkage: {
  endpoint: string;
  pod_name: string;
  actor_id: string;
  workspace_id: string;
}): string {
  return `endpoint=${linkage.endpoint} pod=${linkage.pod_name} actor=${linkage.actor_id} workspace=${linkage.workspace_id}`;
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

function actorBase(config: { endpoint: string; pod_name: string; actor_id: string }): string {
  return `${config.endpoint}/pods/${config.pod_name}/actors/${config.actor_id}`;
}

function workspaceBase(config: { endpoint: string; pod_name: string; actor_id: string }, workspaceId: string): string {
  return `${actorBase(config)}/workspaces/${encodeURIComponent(workspaceId)}`;
}

export class PaseoRemoteClient {
  private readonly config: { endpoint: string; pod_name: string; actor_id: string };

  constructor(config: { endpoint: string; pod_name: string; actor_id: string }) {
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
            actorType: REMOTE_BACKEND_ACTOR_TYPE,
            version: REMOTE_BACKEND_VERSION,
            schema: { type: "object" },
            params: {
              project_id: identity.project_id,
              workspace_ids: [identity.workspace_id],
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

  async getWorkspace(workspaceId: string): Promise<RemoteWorkspaceSummary> {
    return await httpJson<RemoteWorkspaceSummary>(workspaceBase(this.config, workspaceId));
  }

  async importWorkspace(
    workspaceId: string,
    documents: RemoteDocument[],
    replaceMissing = true,
  ): Promise<RemoteImportResult> {
    return await httpJson<RemoteImportResult>(`${workspaceBase(this.config, workspaceId)}/import`, {
      method: "POST",
      body: JSON.stringify({
        documents,
        replace_missing: replaceMissing,
      }),
    });
  }

  async getSnapshot(
    workspaceId: string,
    prefix?: string,
  ): Promise<{ documents?: Array<{ path?: string }> }> {
    const query = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
    return await httpJson<{ documents?: Array<{ path?: string }> }>(
      `${workspaceBase(this.config, workspaceId)}/snapshot${query}`,
    );
  }

  async getDocument(
    workspaceId: string,
    documentPath: string,
  ): Promise<{ document?: { path?: string; content?: string; content_type?: string } }> {
    return await httpJson<{ document?: { path?: string; content?: string; content_type?: string } }>(
      `${workspaceBase(this.config, workspaceId)}/documents?path=${encodeURIComponent(documentPath)}`,
    );
  }
}

export async function ensureRemoteInit(
  repoRoot: string,
  options: EnsureRemoteInitOptions,
): Promise<EnsureRemoteInitResult> {
  let created_pod = false;
  let created_actor = false;
  const endpoint = options.endpoint.trim();
  if (!endpoint) {
    throw new Error("Remote init requires an endpoint");
  }

  const priorTarget = options.existingConfig?.targets[options.identity.workspace_id] ?? null;
  let podName = options.podName?.trim() || priorTarget?.pod_name || "";
  let actorId = options.actorId?.trim() || priorTarget?.actor_id || "";

  if (!podName && !options.provision) {
    throw new Error("Remote init requires --pod-name unless --provision is set");
  }

  const baseClient = new PaseoRemoteClient({
    endpoint,
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
      endpoint,
      pod_name: podName,
      actor_id: "pending-actor",
    });
    actorId = await client.createActor(options.identity);
    created_actor = true;
  }

  const nextTarget: RemoteTarget = {
    pod_name: podName,
    actor_id: actorId,
    last_imported_at: priorTarget?.last_imported_at,
  };

  const config: RemoteLinkConfig = {
    version: REMOTE_CONFIG_VERSION,
    provider: REMOTE_PROVIDER,
    endpoint,
    targets: {
      ...(options.existingConfig?.targets ?? {}),
      [options.identity.workspace_id]: nextTarget,
    },
  };

  await writeRemoteConfig(repoRoot, config);
  return { config, target: nextTarget, created_pod, created_actor };
}

export function extractWorkspaceIdentity(summary: RemoteWorkspaceSummary): {
  project_id?: string | null;
  workspace_id?: string | null;
  actor_type?: string | null;
  backend_version?: string | null;
  document_count?: number | null;
} {
  const source = isObject(summary.source) ? summary.source : {};
  const workspace = isObject(summary.workspace) ? summary.workspace : {};
  const stats = isObject(summary.stats) ? summary.stats : {};
  return {
    project_id: typeof source.project_id === "string" ? source.project_id : null,
    workspace_id: typeof workspace.workspace_id === "string" ? workspace.workspace_id : null,
    actor_type: typeof source.actor_type === "string" ? source.actor_type : null,
    backend_version: typeof source.version === "string" ? source.version : null,
    document_count: typeof stats.document_count === "number" ? stats.document_count : null,
  };
}

export function assertRemoteIdentity(summary: RemoteWorkspaceSummary, identity: WorkspaceIdentity): void {
  const remote = extractWorkspaceIdentity(summary);
  if (!remote.workspace_id) {
    throw new Error(
      "Remote response did not include a workspace.workspace_id envelope. This likely means the linked actor is a legacy v1 backend. Reinitialize the target against reffyRemoteBackend.v2 (`reffy remote init --provision --workspace-id <id>`) and repush with `reffy remote push`.",
    );
  }
  if (remote.project_id !== identity.project_id || remote.workspace_id !== identity.workspace_id) {
    throw new Error(
      `Remote identity mismatch: local=${identity.project_id}/${identity.workspace_id} remote=${String(remote.project_id)}/${String(remote.workspace_id)}`,
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
