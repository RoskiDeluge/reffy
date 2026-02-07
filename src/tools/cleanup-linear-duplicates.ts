import { promises as fs } from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

import { LinearClient, type MappingEntry } from "../linear.js";
import { ReferencesStore } from "../storage.js";

interface MappingFile {
  artifacts: Record<string, MappingEntry>;
}

function isConflictArtifact(name: string, tags: string[]): boolean {
  const normalizedTags = new Set(tags.map((tag) => tag.toLowerCase()));
  if (normalizedTags.has("conflict")) return true;
  return /\(conflict\)/i.test(name);
}

async function readMapping(mappingPath: string): Promise<MappingFile> {
  try {
    const text = await fs.readFile(mappingPath, "utf8");
    const data = JSON.parse(text) as MappingFile;
    if (!data || typeof data !== "object" || !data.artifacts) {
      return { artifacts: {} };
    }
    return data;
  } catch {
    return { artifacts: {} };
  }
}

async function writeMapping(mappingPath: string, mapping: MappingFile): Promise<void> {
  await fs.mkdir(path.dirname(mappingPath), { recursive: true });
  await fs.writeFile(mappingPath, JSON.stringify(mapping, null, 2));
}

async function main(): Promise<number> {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;

  const repoRoot = process.cwd();
  dotenv.config({ path: path.join(repoRoot, ".env") });

  const client = LinearClient.fromEnv();
  if (!client.isConfigured()) {
    console.error("Linear is not configured. Set LINEAR_API_KEY or LINEAR_OAUTH_TOKEN in .env.");
    return 1;
  }

  const store = new ReferencesStore(repoRoot);
  const mappingPath = path.join(repoRoot, ".references", "links", "linear.json");
  const mapping = await readMapping(mappingPath);
  const artifacts = await store.listArtifacts();

  const candidates = artifacts
    .filter((artifact) => isConflictArtifact(artifact.name, artifact.tags ?? []))
    .map((artifact) => {
      const entry = mapping.artifacts[artifact.id];
      return {
        artifact,
        entry,
      };
    })
    .filter((item) => Boolean(item.entry?.issue_id));

  if (candidates.length === 0) {
    console.log("No mapped conflict artifacts found. Nothing to clean up.");
    return 0;
  }

  console.log(`${dryRun ? "[dry-run]" : "[apply]"} Found ${candidates.length} mapped conflict artifacts:`);
  for (const item of candidates) {
    console.log(
      `- artifact=${item.artifact.id} file=${item.artifact.filename} issue=${item.entry?.issue_identifier ?? "unknown"} (${item.entry?.issue_id ?? "n/a"})`,
    );
  }

  if (dryRun) {
    console.log("Run with --apply to archive these Linear issues and remove their local mappings.");
    return 0;
  }

  let archived = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of candidates) {
    const issueId = item.entry?.issue_id;
    if (!issueId) continue;

    try {
      await client.archiveIssue(issueId);
      delete mapping.artifacts[item.artifact.id];
      archived += 1;
    } catch (error) {
      failed += 1;
      errors.push(`${item.artifact.id} (${issueId}): ${String(error)}`);
    }
  }

  await writeMapping(mappingPath, mapping);

  console.log(`Archived ${archived} duplicate/conflict Linear issues.`);
  if (failed > 0) {
    console.log(`Failed to archive ${failed} issues:`);
    for (const error of errors) {
      console.log(`- ${error}`);
    }
    return 2;
  }

  return 0;
}

void main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(String(error));
    process.exitCode = 1;
  },
);
