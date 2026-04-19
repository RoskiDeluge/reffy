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
  workspace_name?: string;
  artifacts: Artifact[];
}
