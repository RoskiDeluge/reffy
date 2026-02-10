#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

import { ReferencesStore } from "./storage.js";

const REFFY_BLOCK = `<!-- REFFY:START -->
# Reffy Instructions

These instructions are for AI assistants working in this project.

Always open \`@/.references/\` when the request:
- Mentions early-stage ideation, exploration, brainstorming, or raw notes
- Needs context before drafting specs or proposals
- Refers to "reffy", "references", "explore", or "context layer"

Use \`.references/\` to:
- Store and read exploratory artifacts (canonical source of truth)
- Optionally connect external systems via separate connector tooling

Keep this managed block so \`reffy init\` can refresh the instructions.

<!-- REFFY:END -->`;

const REFFY_START = "<!-- REFFY:START -->";
const REFFY_END = "<!-- REFFY:END -->";
const OPENSPEC_START = "<!-- OPENSPEC:START -->";

function upsertReffyBlock(content: string): string {
  if (content.includes(REFFY_START) && content.includes(REFFY_END)) {
    const prefix = content.split(REFFY_START)[0] ?? "";
    const suffix = content.split(REFFY_END, 2)[1] ?? "";
    return `${prefix}${REFFY_BLOCK}${suffix.trimStart()}`;
  }

  if (content.includes(OPENSPEC_START)) {
    const [before, after] = content.split(OPENSPEC_START, 2);
    return `${before.trimEnd()}\n\n${REFFY_BLOCK}\n\n${OPENSPEC_START}${after}`;
  }

  return content.trim().length > 0 ? `${REFFY_BLOCK}\n\n${content.trimStart()}` : `${REFFY_BLOCK}\n`;
}

async function initAgents(repoRoot: string): Promise<string> {
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  let content = "";
  try {
    content = await fs.readFile(agentsPath, "utf8");
  } catch {
    content = "";
  }

  const updated = upsertReffyBlock(content);
  await fs.writeFile(agentsPath, updated, "utf8");
  return agentsPath;
}

function parseRepoArg(argv: string[]): string {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--repo") {
      const value = argv[i + 1];
      if (!value) throw new Error("--repo requires a path");
      return path.resolve(value);
    }
    if (arg.startsWith("--repo=")) {
      const value = arg.split("=", 2)[1];
      if (!value) throw new Error("--repo requires a path");
      return path.resolve(value);
    }
  }
  return process.cwd();
}

type OutputMode = "text" | "json";

function parseOutputMode(argv: string[]): OutputMode {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") return "json";
    if (arg === "--output") {
      const value = argv[i + 1];
      if (!value) throw new Error("--output requires a value: text|json");
      if (value !== "text" && value !== "json") throw new Error(`Unsupported output mode: ${value}`);
      return value;
    }
    if (arg.startsWith("--output=")) {
      const value = arg.split("=", 2)[1];
      if (value !== "text" && value !== "json") throw new Error(`Unsupported output mode: ${value}`);
      return value;
    }
  }
  return "text";
}

function printResult(mode: OutputMode, payload: unknown): void {
  if (mode === "json") {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function usage(): string {
  return [
    "Usage: reffy <command> [--repo PATH] [--output text|json]",
    "",
    "Commands:",
    "  init       Ensure AGENTS.md contains the managed Reffy block.",
    "  bootstrap  Initialize AGENTS + .references structure and reindex artifacts.",
    "  reindex    Scan .references/artifacts and add missing files to manifest.",
    "  validate   Validate .references/manifest.json against manifest v1 contract.",
  ].join("\n");
}

async function main(): Promise<number> {
  const [, , command, ...rest] = process.argv;
  if (!command) {
    console.error(usage());
    return 1;
  }

  const output = parseOutputMode(rest);

  if (command === "init") {
    const repoRoot = parseRepoArg(rest);
    const agentsPath = await initAgents(repoRoot);
    const payload = { status: "ok", command: "init", agents_path: agentsPath };
    if (output === "json") {
      printResult(output, payload);
    } else {
      console.log(`Updated ${agentsPath}`);
    }
    return 0;
  }

  if (command === "bootstrap") {
    const repoRoot = parseRepoArg(rest);
    const agentsPath = await initAgents(repoRoot);
    const store = new ReferencesStore(repoRoot);
    const reindex = await store.reindexArtifacts();
    const payload = {
      status: "ok",
      command: "bootstrap",
      agents_path: agentsPath,
      refs_dir: store.refsDir,
      manifest_path: store.manifestPath,
      reindex,
    };
    if (output === "json") {
      printResult(output, payload);
    } else {
      console.log(`Bootstrapped ${store.refsDir}`);
      console.log(`Updated ${agentsPath}`);
      console.log(`Reindex: added=${String(reindex.added)} total=${String(reindex.total)}`);
    }
    return 0;
  }

  if (command === "reindex") {
    const repoRoot = parseRepoArg(rest);
    const store = new ReferencesStore(repoRoot);
    const reindex = await store.reindexArtifacts();
    const payload = { status: "ok", command: "reindex", ...reindex };
    if (output === "json") {
      printResult(output, payload);
    } else {
      console.log(`Reindex complete: added=${String(reindex.added)} total=${String(reindex.total)}`);
    }
    return 0;
  }

  if (command === "validate") {
    const repoRoot = parseRepoArg(rest);
    const store = new ReferencesStore(repoRoot);
    const result = await store.validateManifest();
    const payload = { status: result.ok ? "ok" : "error", command: "validate", ...result };
    if (output === "json") {
      printResult(output, payload);
    } else if (result.ok) {
      console.log(`Manifest valid: artifacts=${String(result.artifact_count)}`);
      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          console.log(`warn: ${warning}`);
        }
      }
    } else {
      console.error(`Manifest invalid: ${String(result.errors.length)} error(s)`);
      for (const error of result.errors) {
        console.error(`error: ${error}`);
      }
      for (const warning of result.warnings) {
        console.error(`warn: ${warning}`);
      }
    }
    return result.ok ? 0 : 1;
  }

  console.error(`Unknown command: ${command}`);
  console.error(usage());
  return 1;
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
