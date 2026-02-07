export interface Artifact {
  id: string;
  name: string;
  filename: string;
  kind: string;
  mime_type: string;
  size_bytes: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ConflictEntry {
  artifact_id: string;
  source: string;
  note: string;
  conflict_artifact_id: string | null;
  created_at: string;
}

export interface Manifest {
  version: number;
  created_at: string;
  updated_at: string;
  artifacts: Artifact[];
  conflicts: ConflictEntry[];
}
