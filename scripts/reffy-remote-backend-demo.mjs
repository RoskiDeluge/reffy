#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

async function loadDotEnvIfPresent(envFile = ".env") {
  const envPath = path.resolve(envFile);
  const text = await fs.readFile(envPath, "utf8").catch(() => null);
  if (text === null) return false;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const normalized = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = normalized.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = normalized.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return true;
}

await loadDotEnvIfPresent(process.env.REFFY_ENV_FILE || ".env");

const ENDPOINT = process.env.PASEO_ENDPOINT;
const REFFY_DIR = process.env.REFFY_DIR || ".reffy";

if (!ENDPOINT) {
  console.error(
    'Set PASEO_ENDPOINT, e.g. export PASEO_ENDPOINT="your-worker-endpoint"',
  );
  process.exit(1);
}

let POD = process.env.PASEO_POD_NAME || null;
let ACTOR = process.env.PASEO_ACTOR_ID || null;

async function readManifestIdentity() {
  const manifestPath = path.resolve(REFFY_DIR, "manifest.json");
  const raw = await fs.readFile(manifestPath, "utf8").catch(() => null);

  if (!raw) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const projectId =
    typeof manifest.project_id === "string" && manifest.project_id.trim()
      ? manifest.project_id.trim()
      : null;

  const workspaceName =
    typeof manifest.workspace_name === "string" &&
    manifest.workspace_name.trim()
      ? manifest.workspace_name.trim()
      : null;

  if (!projectId || !workspaceName) {
    throw new Error(
      `Manifest must define project_id and workspace_name: ${manifestPath}`,
    );
  }

  return { projectId, workspaceName, manifestPath };
}

async function http(url, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} - ${text}`);
  }

  return res;
}

async function httpJson(url, init = {}) {
  const res = await http(url, init);
  return res.json();
}

async function ensurePod() {
  if (POD) return POD;
  const { podName } = await httpJson(`${ENDPOINT}/pods`, { method: "POST" });
  POD = podName;
  return POD;
}

async function ensureActor(projectId, workspaceName) {
  if (ACTOR) return ACTOR;

  const actorConfig = {
    config: {
      actorType: "reffyRemoteBackend",
      version: "v1",
      schema: { type: "object" },
      params: {
        project_id: projectId,
        workspace_name: workspaceName,
        default_lock_ttl_seconds: 120,
        max_snapshot_documents: 1000,
      },
    },
  };

  const { actorId } = await httpJson(`${ENDPOINT}/pods/${POD}/actors`, {
    method: "POST",
    body: JSON.stringify(actorConfig),
  });

  ACTOR = actorId;
  return ACTOR;
}

function actorBase() {
  return `${ENDPOINT}/pods/${POD}/actors/${ACTOR}`;
}

function toWorkspacePath(filePath) {
  const normalized = filePath.split(path.sep).join("/");
  if (normalized === ".reffy" || normalized.startsWith(".reffy/"))
    return normalized;

  const marker = "/.reffy/";
  const idx = normalized.lastIndexOf(marker);
  if (idx >= 0) return normalized.slice(idx + 1);
  if (normalized.endsWith("/.reffy")) return ".reffy";

  return normalized;
}

function contentTypeFor(filePath) {
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".md")) return "text/markdown";
  return "text/plain";
}

async function collectFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "state") continue;
      files.push(...(await collectFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function readLocalWorkspaceDocuments() {
  const absoluteReffyDir = path.resolve(REFFY_DIR);
  const stat = await fs.stat(absoluteReffyDir).catch(() => null);

  if (!stat || !stat.isDirectory()) {
    throw new Error(`Reffy directory not found: ${absoluteReffyDir}`);
  }

  const files = await collectFiles(absoluteReffyDir);
  const documents = [];

  for (const fullPath of files.sort()) {
    const content = await fs.readFile(fullPath, "utf8");
    const workspacePath = toWorkspacePath(
      path.relative(process.cwd(), fullPath),
    );

    documents.push({
      path: workspacePath,
      content,
      content_type: contentTypeFor(workspacePath),
      metadata: {
        source: "local-reffy-import",
        size_bytes: Buffer.byteLength(content, "utf8"),
      },
    });
  }

  return documents;
}

async function importWorkspace(documents) {
  return httpJson(`${actorBase()}/workspace/import`, {
    method: "POST",
    body: JSON.stringify({
      documents,
      replace_missing: true,
    }),
  });
}

async function getWorkspace() {
  return httpJson(`${actorBase()}/workspace`);
}

async function getDocument(docPath) {
  return httpJson(
    `${actorBase()}/workspace/documents?path=${encodeURIComponent(docPath)}`,
  );
}

async function main() {
  console.log(`Using Paseo endpoint: ${ENDPOINT}`);

  const { projectId, workspaceName, manifestPath } =
    await readManifestIdentity();
  await ensurePod();
  await ensureActor(projectId, workspaceName);

  const documents = await readLocalWorkspaceDocuments();
  const importResult = await importWorkspace(documents);
  const workspace = await getWorkspace();
  const manifestDoc = await getDocument(".reffy/manifest.json");

  const remoteProjectId = workspace?.workspace?.project_id || null;
  const remoteWorkspaceName = workspace?.workspace?.workspace_name || null;

  if (remoteProjectId !== projectId || remoteWorkspaceName !== workspaceName) {
    throw new Error(
      `Remote identity mismatch: local=${projectId}/${workspaceName} remote=${remoteProjectId}/${remoteWorkspaceName}`,
    );
  }

  console.log(`Manifest: ${manifestPath}`);
  console.log(`Pod: ${POD}`);
  console.log(`Actor: ${ACTOR}`);
  console.log(`Remote backend base: ${actorBase()}`);
  console.log(`Local Reffy directory: ${path.resolve(REFFY_DIR)}`);
  console.log(`Project identity: ${projectId}`);
  console.log(`Workspace name: ${workspaceName}`);
  console.log(`Imported ${importResult.imported} document(s)`);
  console.log(
    `Created: ${importResult.created}, Updated: ${importResult.updated}, Deleted: ${importResult.deleted}`,
  );
  console.log(
    `Remote document count: ${workspace?.stats?.document_count ?? "unknown"}`,
  );
  console.log(
    `Remote manifest path: ${manifestDoc?.document?.path ?? "missing"}`,
  );

  console.log("\nEnvironment:");
  console.log(`export PASEO_ENDPOINT="${ENDPOINT}"`);
  console.log(`export PASEO_POD_NAME="${POD}"`);
  console.log(`export PASEO_ACTOR_ID="${ACTOR}"`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
