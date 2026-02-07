import { promises as fs } from "node:fs";
import path from "node:path";

import type { ReferencesStore } from "./storage.js";
import type { Artifact } from "./types.js";

interface GraphQLResponse<T> {
  data?: T;
  errors?: unknown;
}

export interface LinearConfig {
  api_key: string | null;
  oauth_token: string | null;
  team_id: string | null;
  project_id: string | null;
  pull_create: boolean;
  pull_label: string | null;
  push_label: string | null;
}

export interface MappingEntry {
  issue_id?: string;
  issue_identifier?: string;
  issue_team_name?: string;
  issue_team_id?: string;
  issue_project_name?: string;
  issue_project_id?: string;
  attachment_id?: string;
  attachment_url?: string;
  attachment_mtime?: number;
  attachment_size?: number;
  last_pushed_at?: string;
  last_pulled_at?: string;
}

interface MappingFile {
  artifacts: Record<string, MappingEntry>;
}

interface LinearIssueNode {
  id?: string;
  identifier?: string;
  title?: string;
  description?: string;
  team?: { id?: string; name?: string };
  project?: { id?: string; name?: string };
  labels?: { nodes?: Array<{ name?: string }> };
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseTs(value: string | undefined): Date | null {
  if (!value) return null;
  const ts = new Date(value);
  return Number.isNaN(ts.getTime()) ? null : ts;
}

function maxTs(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export class LinearClient {
  public readonly config: LinearConfig;
  private readonly baseUrl = "https://api.linear.app/graphql";
  private readonly labelCache = new Map<string, string | null>();

  constructor(config: LinearConfig) {
    this.config = config;
  }

  static fromEnv(): LinearClient {
    const pushLabelRaw = process.env.LINEAR_PUSH_LABEL;
    const pushLabel = pushLabelRaw === undefined ? "reffy" : (pushLabelRaw.trim() || null);
    return new LinearClient({
      api_key: process.env.LINEAR_API_KEY ?? null,
      oauth_token: process.env.LINEAR_OAUTH_TOKEN ?? null,
      team_id: process.env.LINEAR_TEAM_ID ?? null,
      project_id: process.env.LINEAR_PROJECT_ID ?? null,
      pull_create: process.env.LINEAR_PULL_CREATE === "1",
      pull_label: process.env.LINEAR_PULL_LABEL ?? null,
      push_label: pushLabel,
    });
  }

  isConfigured(): boolean {
    return Boolean(this.config.api_key || this.config.oauth_token);
  }

  private headers(): Record<string, string> {
    if (this.config.oauth_token) return { Authorization: `Bearer ${this.config.oauth_token}` };
    if (this.config.api_key) return { Authorization: this.config.api_key };
    return {};
  }

  private async post<TData>(query: string, variables: Record<string, unknown> = {}): Promise<TData> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...this.headers(),
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      throw new Error(`linear_http_${res.status}`);
    }

    const payload = (await res.json()) as GraphQLResponse<TData>;
    if (payload.errors) {
      throw new Error(JSON.stringify(payload.errors));
    }
    if (!payload.data) {
      throw new Error("linear_empty_data");
    }
    return payload.data;
  }

  async getFirstTeamId(): Promise<string | null> {
    const data = await this.post<{ teams?: { nodes?: Array<{ id?: string }> } }>(
      "query { teams { nodes { id } } }",
    );
    return data.teams?.nodes?.[0]?.id ?? null;
  }

  async getLabelId(teamId: string, name: string): Promise<string | null> {
    const key = `${teamId}::${name}`;
    if (this.labelCache.has(key)) {
      return this.labelCache.get(key) ?? null;
    }

    const data = await this.post<{ team?: { labels?: { nodes?: Array<{ id?: string; name?: string }> } } }>(
      "query TeamLabels($id: String!) { team(id: $id) { labels { nodes { id name } } } }",
      { id: teamId },
    );

    const label = data.team?.labels?.nodes?.find((node) => node.name === name);
    const value = label?.id ?? null;
    this.labelCache.set(key, value);
    return value;
  }

  async createIssue(input: {
    title: string;
    description: string;
    team_id: string;
    project_id: string | null;
    label_ids?: string[];
  }): Promise<{ id: string; identifier: string }> {
    const payload: Record<string, unknown> = {
      title: input.title,
      teamId: input.team_id,
      description: input.description,
    };
    if (input.project_id) payload.projectId = input.project_id;
    if (input.label_ids && input.label_ids.length > 0) payload.labelIds = input.label_ids;

    const data = await this.post<{
      issueCreate?: { issue?: { id?: string; identifier?: string } };
    }>(
      "mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier } } }",
      { input: payload },
    );

    const issue = data.issueCreate?.issue;
    if (!issue?.id || !issue.identifier) throw new Error("issue_create_failed");
    return { id: issue.id, identifier: issue.identifier };
  }

  async updateIssue(input: {
    issue_id: string;
    title: string;
    description: string;
  }): Promise<{ id: string; identifier: string }> {
    const data = await this.post<{
      issueUpdate?: { issue?: { id?: string; identifier?: string } };
    }>(
      "mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { id identifier } } }",
      { id: input.issue_id, input: { title: input.title, description: input.description } },
    );

    const issue = data.issueUpdate?.issue;
    if (!issue?.id || !issue.identifier) throw new Error("issue_update_failed");
    return { id: issue.id, identifier: issue.identifier };
  }

  async getIssue(issueId: string): Promise<{
    id: string;
    identifier: string;
    title: string;
    description: string;
    team?: { id?: string; name?: string };
    project?: { id?: string; name?: string };
  }> {
    const data = await this.post<{
      issue?: {
        id?: string;
        identifier?: string;
        title?: string;
        description?: string;
        team?: { id?: string; name?: string };
        project?: { id?: string; name?: string };
      };
    }>(
      "query Issue($id: String!) { issue(id: $id) { id identifier title description team { id name } project { id name } } }",
      { id: issueId },
    );

    const issue = data.issue;
    if (!issue?.id) throw new Error("issue_not_found");
    return {
      id: issue.id,
      identifier: issue.identifier ?? "",
      title: issue.title ?? "",
      description: issue.description ?? "",
      team: issue.team,
      project: issue.project,
    };
  }

  async listIssues(first = 50): Promise<
    LinearIssueNode[]
  > {
    const data = await this.post<{ issues?: { nodes?: LinearIssueNode[] } }>(
      "query Issues($first: Int!) { issues(first: $first) { nodes { id identifier title description team { id name } project { id name } labels { nodes { name } } } } }",
      { first },
    );
    return data.issues?.nodes ?? [];
  }

  async fileUpload(contentType: string, filename: string, size: number): Promise<{
    uploadUrl: string;
    assetUrl: string;
    headers: Array<{ key: string; value: string }>;
  }> {
    const data = await this.post<{
      fileUpload?: {
        success?: boolean;
        uploadFile?: {
          uploadUrl?: string;
          assetUrl?: string;
          headers?: Array<{ key?: string; value?: string }>;
        };
      };
    }>(
      "mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) { fileUpload(contentType: $contentType, filename: $filename, size: $size) { success uploadFile { uploadUrl assetUrl headers { key value } } } }",
      { contentType, filename, size },
    );

    const upload = data.fileUpload?.uploadFile;
    if (!data.fileUpload?.success || !upload?.uploadUrl || !upload.assetUrl) {
      throw new Error("file_upload_failed");
    }

    return {
      uploadUrl: upload.uploadUrl,
      assetUrl: upload.assetUrl,
      headers:
        upload.headers
          ?.filter((h): h is { key: string; value: string } => Boolean(h?.key && h.value !== undefined))
          .map((h) => ({ key: h.key, value: h.value })) ?? [],
    };
  }

  async createAttachment(issueId: string, title: string, url: string): Promise<string> {
    const data = await this.post<{
      attachmentCreate?: { attachment?: { id?: string } };
    }>(
      "mutation AttachmentCreate($input: AttachmentCreateInput!) { attachmentCreate(input: $input) { success attachment { id } } }",
      { input: { issueId, title, url } },
    );
    const id = data.attachmentCreate?.attachment?.id;
    if (!id) throw new Error("attachment_create_failed");
    return id;
  }

  async archiveIssue(issueId: string): Promise<void> {
    const data = await this.post<{
      issueArchive?: { success?: boolean };
    }>(
      "mutation IssueArchive($id: String!) { issueArchive(id: $id) { success } }",
      { id: issueId },
    );
    if (!data.issueArchive?.success) {
      throw new Error("issue_archive_failed");
    }
  }
}

export class LinearSync {
  private readonly repoRoot: string;
  private readonly store: ReferencesStore;
  private readonly client: LinearClient;
  private readonly linksDir: string;
  private readonly mappingPath: string;

  constructor(repoRoot: string, store: ReferencesStore, client: LinearClient) {
    this.repoRoot = repoRoot;
    this.store = store;
    this.client = client;
    this.linksDir = path.join(repoRoot, ".references", "links");
    this.mappingPath = path.join(this.linksDir, "linear.json");
  }

  private async readMapping(): Promise<MappingFile> {
    try {
      const text = await fs.readFile(this.mappingPath, "utf8");
      const parsed = JSON.parse(text) as MappingFile;
      if (!parsed || typeof parsed !== "object" || !parsed.artifacts) {
        return { artifacts: {} };
      }
      return parsed;
    } catch {
      return { artifacts: {} };
    }
  }

  private async writeMapping(data: MappingFile): Promise<void> {
    await fs.mkdir(this.linksDir, { recursive: true });
    await fs.writeFile(this.mappingPath, JSON.stringify(data, null, 2));
  }

  private async artifactDescription(artifact: Artifact): Promise<string> {
    const artifactPath = this.store.getArtifactPath(artifact);
    try {
      if (!artifact.mime_type.startsWith("text/")) {
        return `Binary artifact: ${path.basename(artifactPath)}`;
      }
      return await fs.readFile(artifactPath, "utf8");
    } catch {
      return "";
    }
  }

  private normalizeText(value: string): string {
    return value.trim().replace(/\r\n/g, "\n");
  }

  private fingerprint(title: string, description: string): string {
    return `${this.normalizeText(title).toLowerCase()}::${this.normalizeText(description)}`;
  }

  private titleKey(value: string): string {
    return this.normalizeText(value).toLowerCase();
  }

  private hasLabel(issue: LinearIssueNode, labelName: string | null): boolean {
    if (!labelName) return true;
    const labels = new Set((issue.labels?.nodes ?? []).map((node) => node.name).filter(Boolean));
    return labels.has(labelName);
  }

  private mappingEntryFromIssue(issue: LinearIssueNode, timestampKey: "last_pulled_at" | "last_pushed_at"): MappingEntry {
    const entry: MappingEntry = {
      issue_id: issue.id,
      issue_identifier: issue.identifier,
      issue_team_name: issue.team?.name,
      issue_team_id: issue.team?.id,
      issue_project_name: issue.project?.name,
      issue_project_id: issue.project?.id,
    };
    entry[timestampKey] = nowIso();
    return entry;
  }

  private isConflictArtifact(artifact: Artifact): boolean {
    const tags = new Set((artifact.tags ?? []).map((tag) => tag.toLowerCase()));
    if (tags.has("conflict")) return true;
    return /\(conflict\)/i.test(artifact.name ?? "");
  }

  async push(): Promise<Record<string, unknown>> {
    if (!this.client.isConfigured()) {
      return { status: "error", message: "Linear not configured" };
    }

    const teamId = this.client.config.team_id ?? (await this.client.getFirstTeamId());
    if (!teamId) {
      return { status: "error", message: "No Linear team found" };
    }

    const mapping = await this.readMapping();
    const artifacts = await this.store.listArtifacts();

    let created = 0;
    let updated = 0;
    let reused = 0;
    let skippedConflict = 0;
    let skipped = 0;
    const createdIssueIds: string[] = [];
    const createdIssueIdentifiers: string[] = [];
    const updatedIssueIdentifiers: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const reusedIssueIdentifiers: string[] = [];

    let labelIds: string[] | undefined;
    if (this.client.config.push_label) {
      const labelId = await this.client.getLabelId(teamId, this.client.config.push_label);
      if (labelId) {
        labelIds = [labelId];
      } else {
        warnings.push(`push_label_not_found:${this.client.config.push_label}`);
      }
    }

    // If a local artifact has no mapping but an equivalent Linear issue already exists,
    // reuse that issue mapping instead of creating another duplicate issue.
    const remoteIssues = await this.client.listIssues(100).catch(() => []);
    const usedIssueIds = new Set(
      Object.values(mapping.artifacts)
        .map((item) => item.issue_id)
        .filter((value): value is string => Boolean(value)),
    );
    const remoteByFingerprint = new Map<string, LinearIssueNode[]>();
    const remoteByTitle = new Map<string, LinearIssueNode[]>();
    for (const issue of remoteIssues) {
      if (!issue.id || !this.hasLabel(issue, this.client.config.push_label)) continue;
      const key = this.fingerprint(issue.title ?? "", issue.description ?? "");
      const existing = remoteByFingerprint.get(key) ?? [];
      existing.push(issue);
      remoteByFingerprint.set(key, existing);

      const titleKey = this.titleKey(issue.title ?? "");
      const byTitle = remoteByTitle.get(titleKey) ?? [];
      byTitle.push(issue);
      remoteByTitle.set(titleKey, byTitle);
    }

    for (const artifact of artifacts) {
      if (this.isConflictArtifact(artifact)) {
        skippedConflict += 1;
        continue;
      }

      const artifactId = artifact.id;
      const title = artifact.name || "Untitled";
      const description = await this.artifactDescription(artifact);
      const entry = mapping.artifacts[artifactId];

      try {
        if (entry?.issue_id) {
          const updatedIssue = await this.client.updateIssue({
            issue_id: entry.issue_id,
            title,
            description,
          });
          updated += 1;
          updatedIssueIdentifiers.push(updatedIssue.identifier);
          entry.issue_identifier = updatedIssue.identifier;
          entry.issue_team_id = teamId;
        } else {
          const key = this.fingerprint(title, description);
          const titleKey = this.titleKey(title);
          const candidateByFingerprint = (remoteByFingerprint.get(key) ?? []).find(
            (issue) => issue.id && !usedIssueIds.has(issue.id),
          );
          const candidateByTitle = (remoteByTitle.get(titleKey) ?? []).find(
            (issue) => issue.id && !usedIssueIds.has(issue.id),
          );
          const candidate = candidateByFingerprint ?? candidateByTitle;

          if (candidate?.id) {
            mapping.artifacts[artifactId] = this.mappingEntryFromIssue(candidate, "last_pushed_at");
            usedIssueIds.add(candidate.id);
            reused += 1;
            if (candidate.identifier) reusedIssueIdentifiers.push(candidate.identifier);
          } else {
            const createdIssue = await this.client.createIssue({
              title,
              description,
              team_id: teamId,
              project_id: this.client.config.project_id,
              label_ids: labelIds,
            });
            mapping.artifacts[artifactId] = {
              issue_id: createdIssue.id,
              issue_identifier: createdIssue.identifier,
            };
            usedIssueIds.add(createdIssue.id);
            created += 1;
            createdIssueIds.push(createdIssue.id);
            createdIssueIdentifiers.push(createdIssue.identifier);
          }
        }

        const current = mapping.artifacts[artifactId];
        if (!current?.issue_id) continue;

        const artifactPath = this.store.getArtifactPath(artifact);
        const stat = await fs.stat(artifactPath).catch(() => null);
        if (stat && artifact.mime_type !== "text/markdown") {
          if (current.attachment_mtime !== stat.mtimeMs || current.attachment_size !== stat.size) {
            const upload = await this.client.fileUpload(artifact.mime_type, path.basename(artifactPath), stat.size);
            const uploadHeaders = Object.fromEntries(upload.headers.map((h) => [h.key, h.value]));
            if (!uploadHeaders["Content-Type"]) uploadHeaders["Content-Type"] = artifact.mime_type;
            const fileBuffer = await fs.readFile(artifactPath);
            const putRes = await fetch(upload.uploadUrl, {
              method: "PUT",
              headers: uploadHeaders,
              body: fileBuffer,
            });
            if (!putRes.ok) throw new Error(`attachment_upload_${putRes.status}`);

            const attachmentId = await this.client.createAttachment(current.issue_id, title, upload.assetUrl);
            current.attachment_id = attachmentId;
            current.attachment_url = upload.assetUrl;
            current.attachment_mtime = stat.mtimeMs;
            current.attachment_size = stat.size;
          }
        }

        current.last_pushed_at = nowIso();
      } catch (error) {
        errors.push(`${artifactId}: ${String(error)}`);
        skipped += 1;
      }
    }

    await this.writeMapping(mapping);
    return {
      status: "ok",
      created,
      updated,
      reused,
      skipped_conflict: skippedConflict,
      skipped,
      created_issue_ids: createdIssueIds,
      created_issue_identifiers: createdIssueIdentifiers,
      updated_issue_identifiers: updatedIssueIdentifiers,
      reused_issue_identifiers: reusedIssueIdentifiers,
      errors,
      warnings,
    };
  }

  async pull(): Promise<Record<string, unknown>> {
    if (!this.client.isConfigured()) {
      return { status: "error", message: "Linear not configured" };
    }

    const createConflictCopies = process.env.LINEAR_PULL_CREATE_CONFLICTS !== "0";
    const mapping = await this.readMapping();
    let updated = 0;
    let skipped = 0;
    let reconciled = 0;
    let skippedExistingTitle = 0;
    const updatedIssueIdentifiers: string[] = [];
    const createdIssueIdentifiers: string[] = [];
    const reconciledIssueIdentifiers: string[] = [];
    const conflictArtifactIds: string[] = [];
    const errors: string[] = [];

    for (const [artifactId, entry] of Object.entries(mapping.artifacts)) {
      if (!entry.issue_id) {
        skipped += 1;
        continue;
      }

      try {
        const issue = await this.client.getIssue(entry.issue_id);
        const issueDescription = issue.description || "";
        const localArtifact = await this.store.getArtifact(artifactId);
        const localPath = localArtifact ? this.store.getArtifactPath(localArtifact) : null;
        const localContent = localPath ? await fs.readFile(localPath, "utf8").catch(() => "") : "";
        const lastPulledAt = parseTs(entry.last_pulled_at);
        const lastPushedAt = parseTs(entry.last_pushed_at);
        const lastSyncedAt = maxTs(lastPulledAt, lastPushedAt);
        const localUpdatedAt = parseTs(localArtifact?.updated_at);

        if (localArtifact && localContent !== issueDescription) {
          if (localUpdatedAt && (!lastSyncedAt || localUpdatedAt > lastSyncedAt)) {
            if (createConflictCopies) {
              await this.store.createConflictCopy({
                artifact_id: artifactId,
                source: "linear",
                note: "Local edits detected during pull; conflict copy created.",
              });
              conflictArtifactIds.push(artifactId);
            }
          }
        }

        const updatedArtifact = await this.store.updateArtifact(artifactId, {
          name: issue.title,
          content: issueDescription,
        });

        if (updatedArtifact) {
          updated += 1;
          entry.issue_identifier = issue.identifier;
          entry.issue_team_name = issue.team?.name;
          entry.issue_team_id = issue.team?.id;
          entry.issue_project_name = issue.project?.name;
          entry.issue_project_id = issue.project?.id;
          entry.last_pulled_at = nowIso();
          if (issue.identifier) updatedIssueIdentifiers.push(issue.identifier);
        } else {
          skipped += 1;
        }
      } catch (error) {
        errors.push(`${artifactId}: ${String(error)}`);
        skipped += 1;
      }
    }

    if (this.client.config.pull_create) {
      if (!this.client.config.pull_label) {
        errors.push("pull_create: LINEAR_PULL_LABEL is required");
      } else {
        const localArtifacts = await this.store.listArtifacts();
        const mappedArtifactIds = new Set(Object.keys(mapping.artifacts));
        const mappedIssueIds = new Set(
          Object.values(mapping.artifacts)
            .map((entry) => entry.issue_id)
            .filter((value): value is string => Boolean(value)),
        );
        const localByFingerprint = new Map<string, Artifact[]>();
        const localByTitle = new Map<string, Artifact[]>();
        for (const artifact of localArtifacts) {
          if (this.isConflictArtifact(artifact)) continue;
          const description = await this.artifactDescription(artifact);
          const key = this.fingerprint(artifact.name ?? "", description);
          const existing = localByFingerprint.get(key) ?? [];
          existing.push(artifact);
          localByFingerprint.set(key, existing);

          const titleKey = this.titleKey(artifact.name ?? "");
          const byTitle = localByTitle.get(titleKey) ?? [];
          byTitle.push(artifact);
          localByTitle.set(titleKey, byTitle);
        }

        try {
          const issues = await this.client.listIssues(50);
          for (const issue of issues) {
            if (!issue.id || mappedIssueIds.has(issue.id)) continue;
            if (!this.hasLabel(issue, this.client.config.pull_label)) continue;

            const key = this.fingerprint(issue.title ?? "Untitled", issue.description ?? "");
            const titleKey = this.titleKey(issue.title ?? "Untitled");
            const localMatch = (localByFingerprint.get(key) ?? []).find(
              (artifact) => !mappedArtifactIds.has(artifact.id),
            );
            const localTitleMatch = (localByTitle.get(titleKey) ?? []).find(
              (artifact) => !mappedArtifactIds.has(artifact.id),
            );
            const matchedArtifact = localMatch ?? localTitleMatch;
            if (matchedArtifact) {
              mapping.artifacts[matchedArtifact.id] = this.mappingEntryFromIssue(issue, "last_pulled_at");
              mappedArtifactIds.add(matchedArtifact.id);
              mappedIssueIds.add(issue.id);
              reconciled += 1;
              if (issue.identifier) reconciledIssueIdentifiers.push(issue.identifier);
              continue;
            }

            // If this title already exists locally (even if already mapped), don't create
            // a duplicate local artifact from pull-create.
            if ((localByTitle.get(titleKey) ?? []).length > 0) {
              skippedExistingTitle += 1;
              continue;
            }

            const artifact = await this.store.createArtifact({
              name: issue.title ?? "Untitled",
              content: issue.description ?? "",
              kind: "note",
              mime_type: "text/markdown",
              tags: ["linear", "imported"],
            });

            mapping.artifacts[artifact.id] = this.mappingEntryFromIssue(issue, "last_pulled_at");
            mappedArtifactIds.add(artifact.id);
            mappedIssueIds.add(issue.id);

            if (issue.identifier) createdIssueIdentifiers.push(issue.identifier);
          }
        } catch (error) {
          errors.push(`pull_create: ${String(error)}`);
        }
      }
    }

    await this.writeMapping(mapping);
    return {
      status: "ok",
      updated,
      reconciled,
      skipped_existing_title: skippedExistingTitle,
      skipped,
      created_issue_identifiers: createdIssueIdentifiers,
      updated_issue_identifiers: updatedIssueIdentifiers,
      reconciled_issue_identifiers: reconciledIssueIdentifiers,
      conflict_artifact_ids: conflictArtifactIds,
      errors,
    };
  }
}
