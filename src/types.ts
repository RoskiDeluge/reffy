export interface Artifact {
  id: string;
  name: string;
  filename: string;
  kind: string;
  mime_type: string;
  size_bytes: number;
  tags: string[];
  status?: string;
  related_changes?: string[];
  derived_outputs?: string[];
  created_at: string;
  updated_at: string;
}

export interface Manifest {
  version: number;
  created_at: string;
  updated_at: string;
  project_id?: string;
  workspace_ids?: string[];
  /** Deprecated v1 field retained only as migration input. */
  workspace_name?: string;
  artifacts: Artifact[];
}

export interface RemoteTarget {
  pod_name: string;
  actor_id: string;
  last_imported_at?: string;
}

export interface RemoteLinkConfig {
  version: number;
  provider: "paseo";
  endpoint: string;
  targets: Record<string, RemoteTarget>;
}

export interface RemoteDocument {
  path: string;
  content: string;
  content_type: string;
  metadata?: Record<string, unknown>;
}

export interface RemoteImportResult {
  imported?: number;
  created?: number;
  updated?: number;
  deleted?: number;
}

export interface RemoteWorkspaceSummary {
  source?: Record<string, unknown>;
  workspace?: Record<string, unknown>;
  stats?: Record<string, unknown>;
}
