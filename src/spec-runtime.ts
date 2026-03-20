import { promises as fs } from "node:fs";
import path from "node:path";

import { DEFAULT_PLANNING_DIRNAME } from "./planning-paths.js";

const SPEC_HEADING_SUFFIX = " Specification";
const PURPOSE_HEADING = "## Purpose";
const REQUIREMENT_HEADING_PATTERN = /^###\s+Requirement:\s+(.+)$/;

export interface SpecSummary {
  id: string;
  title: string;
  spec_path: string;
  design_path?: string;
  purpose?: string;
  requirement_count: number;
}

export interface SpecShowResult extends SpecSummary {
  spec: string;
  design?: string;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listDirectories(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

function countRequirements(content: string): number {
  return content.split(/\r?\n/).filter((line) => REQUIREMENT_HEADING_PATTERN.test(line)).length;
}

function extractSpecTitle(content: string, fallback: string): string {
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith("# ")) {
      const title = line.slice(2).trim();
      return title.endsWith(SPEC_HEADING_SUFFIX) ? title.slice(0, -SPEC_HEADING_SUFFIX.length) : title || fallback;
    }
  }
  return fallback;
}

function extractPurpose(content: string): string | undefined {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === PURPOSE_HEADING);
  if (start === -1) return undefined;

  const purposeLines: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? "";
    if (!line) continue;
    if (line.startsWith("## ")) break;
    purposeLines.push(line);
  }

  return purposeLines.length > 0 ? purposeLines.join(" ") : undefined;
}

async function buildSpecSummary(repoRoot: string, specId: string): Promise<SpecSummary> {
  const specDir = path.join(repoRoot, DEFAULT_PLANNING_DIRNAME, "specs", specId);
  const specPath = path.join(specDir, "spec.md");
  const designPath = path.join(specDir, "design.md");
  const content = await fs.readFile(specPath, "utf8");

  return {
    id: specId,
    title: extractSpecTitle(content, specId),
    spec_path: specPath,
    design_path: (await pathExists(designPath)) ? designPath : undefined,
    purpose: extractPurpose(content),
    requirement_count: countRequirements(content),
  };
}

export async function listSpecs(repoRoot: string): Promise<SpecSummary[]> {
  const specsRoot = path.join(repoRoot, DEFAULT_PLANNING_DIRNAME, "specs");
  const specIds = await listDirectories(specsRoot);
  const summaries: SpecSummary[] = [];

  for (const specId of specIds) {
    const specPath = path.join(specsRoot, specId, "spec.md");
    if (!(await pathExists(specPath))) continue;
    summaries.push(await buildSpecSummary(repoRoot, specId));
  }

  return summaries.sort((a, b) => a.id.localeCompare(b.id));
}

export async function showSpec(repoRoot: string, specId: string): Promise<SpecShowResult> {
  const summary = await buildSpecSummary(repoRoot, specId);
  const design = summary.design_path ? await fs.readFile(summary.design_path, "utf8").catch(() => undefined) : undefined;

  return {
    ...summary,
    spec: await fs.readFile(summary.spec_path, "utf8"),
    design,
  };
}
