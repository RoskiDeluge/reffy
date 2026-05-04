import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveRefsDir } from "./refs-paths.js";
import type {
  RemoteActorIdentity,
  RemoteDocument,
  RemoteImportResult,
  RemoteLinkConfig,
  RemoteTarget,
  RemoteWorkspaceSummary,
} from "./types.js";

export const REMOTE_CONFIG_VERSION = 4;
export const REMOTE_PROVIDER = "paseo";
export const REMOTE_BACKEND_ACTOR_TYPE = "reffyRemoteBackend";
export const REMOTE_BACKEND_VERSION = "v2";
export const REMOTE_MANAGER_ACTOR_TYPE = "reffyWorkspaceManager";
export const REMOTE_MANAGER_VERSION = "v1";
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
  manager: RemoteActorIdentity;
  workspace_backend: RemoteActorIdentity;
  last_imported_at?: string;
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

function readActorIdentity(value: unknown, label: string, configPath: string): RemoteActorIdentity {
  if (!isObject(value)) {
    throw new Error(`Remote config at ${configPath} must define ${label} as an object with pod_name and actor_id`);
  }
  if (!isNonEmptyString(value.pod_name)) {
    throw new Error(`Remote config at ${configPath} must define ${label}.pod_name`);
  }
  if (!isNonEmptyString(value.actor_id)) {
    throw new Error(`Remote config at ${configPath} must define ${label}.actor_id`);
  }
  return { pod_name: value.pod_name.trim(), actor_id: value.actor_id.trim() };
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

  if (parsed.version === 1) {
    throw new Error(
      `Remote config at ${configPath} uses the legacy v1 single-target shape. Run \`reffy remote init\` against the workspace manager actor (reffyWorkspaceManager.v1) to reinitialize, then repush with \`reffy remote push\`.`,
    );
  }

  if (parsed.version === 2) {
    throw new Error(
      `Remote config at ${configPath} uses the legacy v2 combined-backend shape. The Paseo backend now splits into reffyWorkspaceManager.v1 (control plane) and reffyRemoteBackend.v2 (per-workspace storage). Run \`reffy remote init --manager-pod <pod> --manager-actor <actor>\` (or \`--provision\`) to reinitialize, then repush with \`reffy remote push\`.`,
    );
  }

  if (parsed.version === 3) {
    throw new Error(
      `Remote config at ${configPath} uses the legacy v3 shape that persisted the Paseo endpoint and pre-dates bearer-token auth. Set PASEO_ENDPOINT and PASEO_TOKEN in your .env, then run \`reffy remote init\` (with \`--provision\` for fresh setups) to reinitialize, and repush with \`reffy remote push\`.`,
    );
  }

  if (parsed.version !== REMOTE_CONFIG_VERSION) {
    throw new Error(
      `Remote config at ${configPath} must use version ${String(REMOTE_CONFIG_VERSION)}`,
    );
  }

  const manager = readActorIdentity(parsed.manager, "manager", configPath);

  if (!isObject(parsed.targets)) {
    throw new Error(`Remote config at ${configPath} must define targets as an object keyed by workspace_id`);
  }

  const targets: Record<string, RemoteTarget> = {};
  for (const [workspaceId, entry] of Object.entries(parsed.targets)) {
    if (!isObject(entry)) {
      throw new Error(`Remote config at ${configPath} has invalid target for workspace_id "${workspaceId}"`);
    }
    const workspace_backend = readActorIdentity(
      entry.workspace_backend,
      `targets.${workspaceId}.workspace_backend`,
      configPath,
    );
    targets[workspaceId] = {
      workspace_backend,
      last_imported_at: isNonEmptyString(entry.last_imported_at) ? entry.last_imported_at.trim() : undefined,
    };
  }

  return {
    version: REMOTE_CONFIG_VERSION,
    provider: REMOTE_PROVIDER,
    manager,
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

export async function removeWorkspaceTarget(
  repoRoot: string,
  existing: RemoteLinkConfig,
  workspaceId: string,
): Promise<{ config: RemoteLinkConfig; existed: boolean }> {
  const existed = Object.prototype.hasOwnProperty.call(existing.targets, workspaceId);
  if (!existed) {
    return { config: existing, existed: false };
  }
  const nextTargets = { ...existing.targets };
  delete nextTargets[workspaceId];
  const next: RemoteLinkConfig = { ...existing, targets: nextTargets };
  await writeRemoteConfig(repoRoot, next);
  return { config: next, existed: true };
}

export async function upsertWorkspaceTarget(
  repoRoot: string,
  existing: RemoteLinkConfig,
  workspaceId: string,
  workspaceBackend: RemoteActorIdentity,
): Promise<RemoteLinkConfig> {
  const priorTarget = existing.targets[workspaceId];
  const next: RemoteLinkConfig = {
    ...existing,
    targets: {
      ...existing.targets,
      [workspaceId]: {
        workspace_backend: workspaceBackend,
        last_imported_at: priorTarget?.last_imported_at,
      },
    },
  };
  await writeRemoteConfig(repoRoot, next);
  return next;
}

export function resolveRemoteTarget(
  stored: RemoteLinkConfig | null,
  workspaceId: string,
  endpoint: string,
): ResolvedRemoteTarget | null {
  if (!stored) return null;
  const target = stored.targets[workspaceId];
  if (!target) return null;
  return {
    endpoint,
    manager: stored.manager,
    workspace_backend: target.workspace_backend,
    last_imported_at: target.last_imported_at,
  };
}

export function describeRemoteLinkage(linkage: {
  endpoint: string;
  manager: RemoteActorIdentity;
  workspace_backend: RemoteActorIdentity;
  workspace_id: string;
}): string {
  return [
    `endpoint=${linkage.endpoint}`,
    `manager=${linkage.manager.pod_name}/${linkage.manager.actor_id}`,
    `workspace_backend=${linkage.workspace_backend.pod_name}/${linkage.workspace_backend.actor_id}`,
    `workspace=${linkage.workspace_id}`,
  ].join(" ");
}

export class RemoteHttpError extends Error {
  readonly status: number;
  readonly body: string;
  readonly url: string;
  readonly method: string;
  constructor(status: number, statusText: string, body: string, url: string, method: string) {
    super(`${String(status)} ${statusText} - ${body}`);
    this.status = status;
    this.body = body;
    this.url = url;
    this.method = method;
  }
}

interface HttpOptions extends RequestInit {
  token?: string;
}

async function http(url: string, init: HttpOptions = {}): Promise<Response> {
  const { token, headers: rawHeaders, ...rest } = init;
  const headers = new Headers(rawHeaders ?? {});
  if (!headers.has("Content-Type") && rest.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { ...rest, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new RemoteHttpError(response.status, response.statusText, text, url, rest.method ?? "GET");
  }

  return response;
}

async function httpJson<T>(url: string, init: HttpOptions = {}): Promise<T> {
  const response = await http(url, init);
  return (await response.json()) as T;
}

function actorBase(endpoint: string, identity: RemoteActorIdentity): string {
  return `${endpoint}/pods/${identity.pod_name}/actors/${identity.actor_id}`;
}

export interface ManagerWorkspaceResponse {
  workspace?: {
    workspace_id?: string;
    backend?: {
      pod_name?: string;
      actor_id?: string;
    };
    metadata?: Record<string, unknown>;
  };
}

export interface ManagerProjectListResponse {
  projects?: Array<{ project_id?: string; metadata?: Record<string, unknown> }>;
}

export interface ManagerProjectResponse {
  project?: { project_id?: string; metadata?: Record<string, unknown> };
}

export interface CreateManagerActorResult {
  actorId: string;
  managerAuthToken: string;
}

export class PaseoManagerClient {
  private readonly endpoint: string;
  private readonly identity: RemoteActorIdentity;
  private readonly token?: string;

  constructor(endpoint: string, identity: RemoteActorIdentity, token?: string) {
    this.endpoint = endpoint;
    this.identity = identity;
    this.token = token;
  }

  private base(): string {
    return actorBase(this.endpoint, this.identity);
  }

  private requireToken(): string {
    if (!this.token) {
      throw new Error(
        "Manager request requires PASEO_TOKEN to be set in the environment. Add it to your .env (or export it) and retry.",
      );
    }
    return this.token;
  }

  async createPod(): Promise<string> {
    const result = await httpJson<{ podName: string }>(`${this.endpoint}/pods`, { method: "POST" });
    if (!isNonEmptyString(result.podName)) {
      throw new Error("Paseo create pod response missing podName");
    }
    return result.podName.trim();
  }

  async createManagerActor(podName: string): Promise<CreateManagerActorResult> {
    const result = await httpJson<{ actorId: string; managerAuthToken: string }>(
      `${this.endpoint}/pods/${podName}/actors`,
      {
        method: "POST",
        body: JSON.stringify({
          config: {
            actorType: REMOTE_MANAGER_ACTOR_TYPE,
            version: REMOTE_MANAGER_VERSION,
            schema: { type: "object" },
            params: {},
          },
        }),
      },
    );
    if (!isNonEmptyString(result.actorId)) {
      throw new Error("Paseo create manager actor response missing actorId");
    }
    if (!isNonEmptyString(result.managerAuthToken)) {
      throw new Error(
        "Paseo create manager actor response missing managerAuthToken. The backend may not yet expose bearer-token issuance for reffyWorkspaceManager.v1.",
      );
    }
    return { actorId: result.actorId.trim(), managerAuthToken: result.managerAuthToken.trim() };
  }

  async createWorkspace(workspaceId: string, metadata?: Record<string, unknown>): Promise<RemoteActorIdentity> {
    const result = await httpJson<ManagerWorkspaceResponse>(`${this.base()}/workspaces`, {
      method: "POST",
      token: this.requireToken(),
      body: JSON.stringify({
        workspace_id: workspaceId,
        metadata: metadata ?? {},
        controller: { client: "reffy-cli" },
      }),
    });
    return extractWorkspaceBackendIdentity(result, workspaceId, "createWorkspace");
  }

  async getWorkspace(workspaceId: string): Promise<RemoteActorIdentity> {
    const result = await httpJson<ManagerWorkspaceResponse>(
      `${this.base()}/workspaces/${encodeURIComponent(workspaceId)}`,
      { token: this.requireToken() },
    );
    return extractWorkspaceBackendIdentity(result, workspaceId, "getWorkspace");
  }

  async registerProject(workspaceId: string, projectId: string): Promise<{ alreadyRegistered: boolean }> {
    try {
      await http(
        `${this.base()}/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}`,
        {
          method: "POST",
          token: this.requireToken(),
          body: JSON.stringify({
            owner: { source: "reffy-cli" },
            metadata: { source: "reffy-cli" },
          }),
        },
      );
      return { alreadyRegistered: false };
    } catch (error) {
      if (error instanceof RemoteHttpError && error.status === 409) {
        return { alreadyRegistered: true };
      }
      throw error;
    }
  }

  async listProjects(workspaceId: string): Promise<ManagerProjectListResponse> {
    return await httpJson<ManagerProjectListResponse>(
      `${this.base()}/workspaces/${encodeURIComponent(workspaceId)}/projects`,
      { token: this.requireToken() },
    );
  }

  async getProject(workspaceId: string, projectId: string): Promise<ManagerProjectResponse> {
    return await httpJson<ManagerProjectResponse>(
      `${this.base()}/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}`,
      { token: this.requireToken() },
    );
  }

  async deleteWorkspace(workspaceId: string): Promise<{ alreadyAbsent: boolean }> {
    try {
      await http(`${this.base()}/workspaces/${encodeURIComponent(workspaceId)}`, {
        method: "DELETE",
        token: this.requireToken(),
      });
      return { alreadyAbsent: false };
    } catch (error) {
      if (error instanceof RemoteHttpError && error.status === 404) {
        return { alreadyAbsent: true };
      }
      throw error;
    }
  }
}

function extractWorkspaceBackendIdentity(
  response: ManagerWorkspaceResponse,
  workspaceId: string,
  context: string,
): RemoteActorIdentity {
  const workspace = response.workspace;
  if (!isObject(workspace)) {
    throw new Error(`Manager ${context} response missing workspace envelope for "${workspaceId}"`);
  }
  const backend = workspace.backend;
  if (!isObject(backend)) {
    throw new Error(`Manager ${context} response missing workspace.backend for "${workspaceId}"`);
  }
  if (!isNonEmptyString(backend.pod_name) || !isNonEmptyString(backend.actor_id)) {
    throw new Error(`Manager ${context} response missing workspace.backend.pod_name or actor_id for "${workspaceId}"`);
  }
  return { pod_name: backend.pod_name.trim(), actor_id: backend.actor_id.trim() };
}

export interface ProjectDocumentListResponse {
  documents?: Array<{ path?: string; content?: string; content_type?: string; metadata?: Record<string, unknown> }>;
}

export interface ProjectDocumentResponse {
  document?: { path?: string; content?: string; content_type?: string; metadata?: Record<string, unknown> };
}

export interface ProjectSnapshotResponse {
  snapshot?: Record<string, unknown>;
  documents?: Array<{ path?: string }>;
}

export class PaseoWorkspaceBackendClient {
  private readonly endpoint: string;
  private readonly identity: RemoteActorIdentity;
  private readonly token: string;

  constructor(endpoint: string, identity: RemoteActorIdentity, token: string) {
    if (!token) {
      throw new Error(
        "PaseoWorkspaceBackendClient requires a bearer token. Set PASEO_TOKEN in your .env (or export it) before invoking remote commands.",
      );
    }
    this.endpoint = endpoint;
    this.identity = identity;
    this.token = token;
  }

  private base(): string {
    return `${actorBase(this.endpoint, this.identity)}/workspace`;
  }

  async getWorkspace(): Promise<RemoteWorkspaceSummary> {
    return await httpJson<RemoteWorkspaceSummary>(this.base(), { token: this.token });
  }

  async importProject(
    projectId: string,
    documents: RemoteDocument[],
    replaceMissing = true,
  ): Promise<RemoteImportResult> {
    return await httpJson<RemoteImportResult>(
      `${this.base()}/projects/${encodeURIComponent(projectId)}/import`,
      {
        method: "POST",
        token: this.token,
        body: JSON.stringify({ documents, replace_missing: replaceMissing }),
      },
    );
  }

  async listProjectDocuments(
    projectId: string,
    options: { prefix?: string } = {},
  ): Promise<ProjectDocumentListResponse> {
    const params = new URLSearchParams();
    if (options.prefix) params.set("prefix", options.prefix);
    const query = params.toString();
    return await httpJson<ProjectDocumentListResponse>(
      `${this.base()}/projects/${encodeURIComponent(projectId)}/documents${query ? `?${query}` : ""}`,
      { token: this.token },
    );
  }

  async getProjectDocument(projectId: string, documentPath: string): Promise<ProjectDocumentResponse> {
    return await httpJson<ProjectDocumentResponse>(
      `${this.base()}/projects/${encodeURIComponent(projectId)}/documents?path=${encodeURIComponent(documentPath)}`,
      { token: this.token },
    );
  }

  async getProjectSnapshot(projectId: string): Promise<ProjectSnapshotResponse> {
    return await httpJson<ProjectSnapshotResponse>(
      `${this.base()}/projects/${encodeURIComponent(projectId)}/snapshot`,
      { token: this.token },
    );
  }
}

export interface EnsureManagerInitOptions {
  endpoint: string;
  managerPodName?: string;
  managerActorId?: string;
  provision: boolean;
  existingConfig: RemoteLinkConfig | null;
}

export interface EnsureManagerInitResult {
  config: RemoteLinkConfig;
  created_pod: boolean;
  created_actor: boolean;
  /** Bearer token returned by the backend when a fresh manager actor was created. Only set when `created_actor` is true. */
  manager_auth_token?: string;
}

export async function ensureManagerInit(
  repoRoot: string,
  options: EnsureManagerInitOptions,
): Promise<EnsureManagerInitResult> {
  const endpoint = options.endpoint.trim();
  if (!endpoint) {
    throw new Error("Remote init requires an endpoint");
  }

  const prior = options.existingConfig;
  let podName = (options.managerPodName ?? prior?.manager.pod_name ?? "").trim();
  let actorId = (options.managerActorId ?? prior?.manager.actor_id ?? "").trim();
  let created_pod = false;
  let created_actor = false;
  let manager_auth_token: string | undefined;

  if (!podName && !options.provision) {
    throw new Error(
      "Remote init requires --manager-pod (or --provision to create a fresh pod and manager actor)",
    );
  }

  // createPod and createManagerActor do not require a bearer token; the manager actor itself issues the token.
  const provisioner = new PaseoManagerClient(endpoint, {
    pod_name: podName || "pending-pod",
    actor_id: actorId || "pending-actor",
  });

  if (!podName) {
    podName = await provisioner.createPod();
    created_pod = true;
  }

  if (!actorId) {
    if (!options.provision) {
      throw new Error(
        "Remote init requires --manager-actor unless --provision is set so the CLI can create a fresh manager actor",
      );
    }
    const result = await new PaseoManagerClient(endpoint, {
      pod_name: podName,
      actor_id: "pending-actor",
    }).createManagerActor(podName);
    actorId = result.actorId;
    manager_auth_token = result.managerAuthToken;
    created_actor = true;
  }

  const config: RemoteLinkConfig = {
    version: REMOTE_CONFIG_VERSION,
    provider: REMOTE_PROVIDER,
    manager: { pod_name: podName, actor_id: actorId },
    targets: prior?.targets ?? {},
  };
  await writeRemoteConfig(repoRoot, config);
  return { config, created_pod, created_actor, manager_auth_token };
}

export type WorkspaceTargetMode = "create" | "resolve" | "auto";

export interface EnsureWorkspaceTargetOptions {
  workspaceId: string;
  mode: WorkspaceTargetMode;
  endpoint: string;
  token: string;
  metadata?: Record<string, unknown>;
}

export interface EnsureWorkspaceTargetResult {
  config: RemoteLinkConfig;
  workspace_backend: RemoteActorIdentity;
  outcome: "created" | "resolved" | "reused";
}

export async function ensureWorkspaceTarget(
  repoRoot: string,
  config: RemoteLinkConfig,
  options: EnsureWorkspaceTargetOptions,
): Promise<EnsureWorkspaceTargetResult> {
  const manager = new PaseoManagerClient(options.endpoint, config.manager, options.token);
  const existing = config.targets[options.workspaceId];

  if (options.mode === "resolve" || (options.mode === "auto" && existing)) {
    try {
      const backend = await manager.getWorkspace(options.workspaceId);
      const nextConfig = await upsertWorkspaceTarget(repoRoot, config, options.workspaceId, backend);
      return { config: nextConfig, workspace_backend: backend, outcome: existing ? "reused" : "resolved" };
    } catch (error) {
      if (options.mode === "resolve") throw error;
      // fall through to create on auto
    }
  }

  // create (or auto with no existing)
  try {
    const backend = await manager.createWorkspace(options.workspaceId, options.metadata);
    const nextConfig = await upsertWorkspaceTarget(repoRoot, config, options.workspaceId, backend);
    return { config: nextConfig, workspace_backend: backend, outcome: "created" };
  } catch (error) {
    if (error instanceof RemoteHttpError && error.status === 409) {
      const backend = await manager.getWorkspace(options.workspaceId);
      const nextConfig = await upsertWorkspaceTarget(repoRoot, config, options.workspaceId, backend);
      return { config: nextConfig, workspace_backend: backend, outcome: "resolved" };
    }
    throw error;
  }
}

export function extractWorkspaceSummaryIdentity(summary: RemoteWorkspaceSummary): {
  workspace_id?: string | null;
  actor_type?: string | null;
  backend_version?: string | null;
  document_count?: number | null;
  registered_project_count?: number | null;
} {
  const top = summary as Record<string, unknown>;
  const source = isObject(summary.source) ? summary.source : {};
  const workspace = isObject(summary.workspace) ? summary.workspace : {};
  const stats = isObject(summary.stats) ? summary.stats : {};
  const actorType =
    typeof source.actor_type === "string"
      ? source.actor_type
      : typeof top.actor_type === "string"
        ? (top.actor_type as string)
        : null;
  const backendVersion =
    typeof source.version === "string"
      ? source.version
      : typeof top.version === "string"
        ? (top.version as string)
        : null;
  const documentCount =
    typeof stats.document_count === "number"
      ? stats.document_count
      : typeof stats.source_document_count === "number"
        ? stats.source_document_count
        : null;
  return {
    workspace_id: typeof workspace.workspace_id === "string" ? workspace.workspace_id : null,
    actor_type: actorType,
    backend_version: backendVersion,
    document_count: documentCount,
    registered_project_count:
      typeof stats.registered_project_count === "number" ? stats.registered_project_count : null,
  };
}

export function assertWorkspaceSummaryIdentity(
  summary: RemoteWorkspaceSummary,
  expectedWorkspaceId: string,
): void {
  const remote = extractWorkspaceSummaryIdentity(summary);
  if (!remote.workspace_id) {
    throw new Error(
      "Remote workspace summary did not include a workspace.workspace_id envelope. The linked actor may be a legacy v1 backend or a non-workspace actor. Reinitialize against reffyWorkspaceManager.v1 + reffyRemoteBackend.v2 (`reffy remote init`) and repush with `reffy remote push`.",
    );
  }
  if (remote.workspace_id !== expectedWorkspaceId) {
    throw new Error(
      `Remote identity mismatch: expected workspace_id=${expectedWorkspaceId} but workspace backend reported workspace_id=${String(remote.workspace_id)}. Re-resolve the workspace through the manager (\`reffy remote workspace get ${expectedWorkspaceId}\`) or reinitialize linkage.`,
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
