import { promises as fs } from "node:fs";
import path from "node:path";

import {
  DEFAULT_PLANNING_DIRNAME,
  LEGACY_PLANNING_DIRNAME,
  detectPlanningState,
  resolveCanonicalPlanningDir,
  type PlanningState,
} from "./planning-paths.js";

export interface PlanningPreparationResult {
  state: PlanningState;
  migrated: boolean;
  created: boolean;
  message?: string;
}

const DEFAULT_PROJECT_CONTEXT_TEMPLATE = `# Project Context

## Purpose
[Describe your project's purpose and goals]

## Tech Stack
- [List your primary technologies]
- [e.g., TypeScript, React, Node.js]

## Project Conventions

### Code Style
[Describe your code style preferences, formatting rules, and naming conventions]

### Architecture Patterns
[Document your architectural decisions and patterns]

### Testing Strategy
[Explain your testing approach and requirements]

### Git Workflow
[Describe your branching strategy and commit conventions]

## Domain Context
[Add domain-specific knowledge that AI assistants need to understand]

## Important Constraints
[List any technical, business, or regulatory constraints]

## External Dependencies
[Document key external services, APIs, or systems]
`;

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureCanonicalPlanningStructure(repoRoot: string): Promise<boolean> {
  const planningDir = resolveCanonicalPlanningDir(repoRoot);
  const projectContextPath = path.join(planningDir, "project.md");
  let created = false;

  if (!(await pathExists(planningDir))) {
    created = true;
  }

  await fs.mkdir(path.join(planningDir, "changes", "archive"), { recursive: true });
  await fs.mkdir(path.join(planningDir, "specs"), { recursive: true });
  if (!(await pathExists(projectContextPath))) {
    await fs.writeFile(projectContextPath, DEFAULT_PROJECT_CONTEXT_TEMPLATE, "utf8");
  }
  return created;
}

export async function prepareCanonicalPlanningLayout(repoRoot: string): Promise<PlanningPreparationResult> {
  const current = detectPlanningState(repoRoot);

  if (current.mode === "legacy") {
    await fs.rename(current.legacyDir, current.canonicalDir);
    return {
      state: detectPlanningState(repoRoot),
      migrated: true,
      created: false,
      message: `Migrated ${LEGACY_PLANNING_DIRNAME}/ to ${DEFAULT_PLANNING_DIRNAME}/`,
    };
  }

  const created = await ensureCanonicalPlanningStructure(repoRoot);
  return {
    state: detectPlanningState(repoRoot),
    migrated: false,
    created,
  };
}
