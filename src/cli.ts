#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const REFFY_BLOCK = `<!-- REFFY:START -->
# Reffy Instructions

These instructions are for AI assistants working in this project.

Always open \`@/.references/\` when the request:
- Mentions early-stage ideation, exploration, brainstorming, or raw notes
- Needs context before drafting specs or proposals
- Refers to "reffy", "references", "explore", or "context layer"

Use \`.references/\` to:
- Store and read exploratory artifacts (canonical source of truth)
- Sync to Linear via the local Reffy server if configured

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
  const repoIndex = argv.findIndex((arg) => arg === "--repo");
  if (repoIndex === -1) return process.cwd();
  const value = argv[repoIndex + 1];
  if (!value) throw new Error("--repo requires a path");
  return path.resolve(value);
}

async function main(): Promise<number> {
  const [, , command, ...rest] = process.argv;
  if (!command) {
    console.error("Usage: reffy init [--repo PATH]");
    return 1;
  }

  if (command === "init") {
    const repoRoot = parseRepoArg(rest);
    const output = await initAgents(repoRoot);
    console.log(`Updated ${output}`);
    return 0;
  }

  console.error(`Unknown command: ${command}`);
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
