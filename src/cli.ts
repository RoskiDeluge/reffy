#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync, promises as fs, statSync } from "node:fs";
import path from "node:path";

import { renderDiagram } from "./diagram.js";
import { runDoctor } from "./doctor.js";
import { archivePlanningChange } from "./plan-archive.js";
import { createPlanScaffold } from "./plan.js";
import { DEFAULT_PLANNING_DIRNAME } from "./planning-paths.js";
import { listPlanningChanges, showPlanningChange, validatePlanningChange } from "./plan-runtime.js";
import { DEFAULT_REFS_DIRNAME, looksLikeRefsDir } from "./refs-paths.js";
import { prepareCanonicalPlanningLayout } from "./planning-workspace.js";
import { ReferencesStore } from "./storage.js";
import { listSpecs, showSpec } from "./spec-runtime.js";
import { summarizeArtifacts } from "./summarize.js";
import { prepareCanonicalWorkspace } from "./workspace.js";

const require = createRequire(import.meta.url);
const { version: packageVersion } = require("../package.json") as { version: string };

const REFFY_ASCII = [
  "            __  __      ",
  " _ __ ___  / _|/ _|_   _",
  "| '__/ _ \\| |_| |_| | | |",
  "| | |  __/|  _|  _| |_| |",
  "|_|  \\___||_| |_|  \\__, |",
  "                   |___/ ",
].join("\n");

const BOOTSTRAP_AGENT_INSTRUCTION = [
  'Please read `AGENTS.md` and help me fill out the project context template in `reffyspec/project.md`',
  "with details about my project, tech stack, architecture, and conventions.",
].join(" ");

function buildReffyBlock(refsDirName: string): string {
  return `<!-- REFFY:START -->
# Reffy Instructions

These instructions are for AI assistants working in this project.

Always open \`@/${refsDirName}/AGENTS.md\` when the request:
- Mentions early-stage ideation, exploration, brainstorming, or raw notes
- Needs context before drafting specs or proposals
- Refers to "reffy", "references", "explore", or "context layer"

Use \`@/${refsDirName}/AGENTS.md\` to learn:
- Reffy workflow for ideation, artifact indexing, and planning scaffolds
- How Reffy owns the runtime while preserving ReffySpec planning files
- How to store and consume ideation context in \`${refsDirName}/\`

Keep this managed block so \`reffy init\` can refresh the instructions.

<!-- REFFY:END -->`;
}

function buildReffySpecBlock(): string {
  return `<!-- REFFYSPEC:START -->
# ReffySpec Instructions

These instructions are for AI assistants working in this project.

Always open \`@/${DEFAULT_PLANNING_DIRNAME}/AGENTS.md\` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Needs the authoritative planning/spec workflow for this repo

Use \`@/${DEFAULT_PLANNING_DIRNAME}/AGENTS.md\` to learn:
- How to create and apply ReffySpec change proposals
- ReffySpec format and conventions
- Project structure and planning guidelines

Keep this managed block so \`reffy init\` can refresh the instructions.

<!-- REFFYSPEC:END -->`;
}

function buildReffyAgentsContent(refsDirName: string): string {
  return `# Reffy Instructions

These instructions are for AI assistants working in this project.

## TL;DR Checklist

- Decide whether Reffy ideation is needed for this request.
- If needed, read existing context in \`${refsDirName}/artifacts/\`.
- Add/update exploratory artifacts and keep them concise.
- Run \`reffy reindex\` and \`reffy validate\` after artifact changes.
- Use \`reffy summarize --output json\` and \`reffy plan create\` to turn artifact context into planning scaffolds.

## When To Use Reffy

Use Reffy first when the request:
- Mentions early-stage ideation, exploration, brainstorming, or raw notes
- Needs context gathering before drafting a concrete implementation plan
- Refers to "reffy", "references", "explore", "context layer", or research artifacts

## When To Skip Reffy

You can skip Reffy when the request is:
- A narrow bug fix that does not need exploratory context
- A small refactor with no requirement/design ambiguity
- A formatting, typing, or tooling-only update with clear scope

## Reffy Workflow

1. Read existing artifacts in \`${refsDirName}/artifacts/\`.
2. Add or update artifacts to capture exploratory context.
3. Run \`reffy reindex\` to index newly added files into \`${refsDirName}/manifest.json\`.
4. Run \`reffy validate\` to verify manifest contract compliance.
5. Run \`reffy plan create\` to generate proposal/tasks/spec scaffolds from selected artifacts when planning is ready.

## Relationship To ReffySpec

- Reffy owns ideation artifacts, manifest metadata, and native planning scaffolds.
- ReffySpec is the planning subsystem inside Reffy.
- The vendored fork at \`/.vendor/ReffySpec\` is reference-only for v1; first-party behavior lives in this repo.
- Reffy is the primary runtime authority for this project.
- ReffySpec files live under \`${DEFAULT_PLANNING_DIRNAME}/\` as the canonical planning layout.
- Do not duplicate full proposal/spec content in Reffy artifacts; generate and link planning outputs from them.

## ReffySpec Citation Rules

When a ReffySpec proposal is informed by Reffy artifacts:
- After ideation approval, run \`reffy summarize --output json\` to shortlist candidate artifacts.
- Include a short "Reffy References" subsection in \`proposal.md\` (or design notes if more appropriate).
- Cite only artifact filenames that directly informed the proposal's problem, scope, decisions, or constraints.
- Cite artifact filenames and intent, for example:
  - \`testing.md\` - early constraints and tradeoffs for manifest validation
- Do not include generic process artifacts or unrelated notes just because they exist.
- Keep citations at proposal/design level; task-by-task traceability is optional unless the change is high risk.
- If no Reffy artifacts informed the change, explicitly state "No Reffy references used."

### Reusable Proposal Snippet

Use this in \`${DEFAULT_PLANNING_DIRNAME}/changes/<change-id>/proposal.md\`:

\`\`\`md
## Reffy References
- \`artifact-name.md\` - short note about how it informed this proposal
\`\`\`

If none were used:

\`\`\`md
## Reffy References
No Reffy references used.
\`\`\`

## Artifact Conventions

- Treat \`${refsDirName}/\` as a repository-local guidance and ideation context layer.
- Keep artifact names clear and stable.
- Prefer markdown notes for exploratory content.
- Keep manifests machine-readable and schema-compliant (version 1).
`;
}

function buildReffySpecAgentsContent(): string {
  return `# ReffySpec Instructions

These instructions are for AI assistants working in this project.

## TL;DR Checklist

- Read the relevant current specs in \`${DEFAULT_PLANNING_DIRNAME}/specs/\` before changing behavior.
- Review active changes in \`${DEFAULT_PLANNING_DIRNAME}/changes/\` before drafting or implementing new work.
- Use ReffySpec change proposals for new capabilities, breaking changes, or architecture shifts.
- Keep current truth in \`${DEFAULT_PLANNING_DIRNAME}/specs/\` and proposed deltas in \`${DEFAULT_PLANNING_DIRNAME}/changes/\`.

## ReffySpec Workflow

1. Read \`${DEFAULT_PLANNING_DIRNAME}/project.md\` for project conventions.
2. Inspect current specs in \`${DEFAULT_PLANNING_DIRNAME}/specs/\`.
3. Inspect active changes in \`${DEFAULT_PLANNING_DIRNAME}/changes/\`.
4. Draft or update proposal/design/tasks/spec files under \`${DEFAULT_PLANNING_DIRNAME}/changes/<change-id>/\`.
5. Use native Reffy commands for routine planning workflow:
   - \`reffy plan create\`
   - \`reffy plan validate\`
   - \`reffy plan list\`
   - \`reffy plan show\`
   - \`reffy plan archive\`
   - \`reffy spec list\`
   - \`reffy spec show\`

## Directory Model

- \`${DEFAULT_PLANNING_DIRNAME}/changes/\` contains active proposed changes.
- \`${DEFAULT_PLANNING_DIRNAME}/changes/archive/\` contains historical archived changes.
- \`${DEFAULT_PLANNING_DIRNAME}/specs/\` contains current truth for each capability.

## Proposal Rules

- Use a unique verb-led \`change-id\` in kebab-case.
- Include \`proposal.md\`, \`tasks.md\`, optional \`design.md\`, and delta specs per affected capability.
- Delta specs must use \`## ADDED|MODIFIED|REMOVED|RENAMED Requirements\`.
- Each requirement must include at least one \`#### Scenario:\`.

## Reffy Relationship

- Reffy owns the runtime and artifact workflow.
- ReffySpec is the canonical planning/spec surface.
- Reffy artifacts in \`.reffy/\` should inform proposal/design content without duplicating the full planning files.
`;
}

const REFFY_START = "<!-- REFFY:START -->";
const REFFY_END = "<!-- REFFY:END -->";
const REFFYSPEC_START = "<!-- REFFYSPEC:START -->";
const REFFYSPEC_END = "<!-- REFFYSPEC:END -->";
const OPENSPEC_START = "<!-- OPENSPEC:START -->";
const OPENSPEC_END = "<!-- OPENSPEC:END -->";

function upsertReffyBlock(content: string): string {
  return upsertReffyBlockForDir(content, DEFAULT_REFS_DIRNAME);
}

function upsertReffyBlockForDir(content: string, refsDirName: string): string {
  const reffyBlock = buildReffyBlock(refsDirName);
  if (content.includes(REFFY_START) && content.includes(REFFY_END)) {
    const prefix = content.split(REFFY_START)[0] ?? "";
    const suffix = content.split(REFFY_END, 2)[1] ?? "";
    const trimmedSuffix = suffix.trimStart();
    return trimmedSuffix.length > 0 ? `${prefix}${reffyBlock}\n\n${trimmedSuffix}` : `${prefix}${reffyBlock}\n`;
  }

  if (content.includes(OPENSPEC_START)) {
    const [before, after] = content.split(OPENSPEC_START, 2);
    return `${before.trimEnd()}\n\n${reffyBlock}\n\n${OPENSPEC_START}${after}`;
  }

  return content.trim().length > 0 ? `${reffyBlock}\n\n${content.trimStart()}` : `${reffyBlock}\n`;
}

function upsertPlanningBlock(content: string): string {
  const reffyspecBlock = buildReffySpecBlock();

  if (content.includes(REFFYSPEC_START) && content.includes(REFFYSPEC_END)) {
    const prefix = content.split(REFFYSPEC_START)[0] ?? "";
    const suffix = content.split(REFFYSPEC_END, 2)[1] ?? "";
    const trimmedSuffix = suffix.trimStart();
    return trimmedSuffix.length > 0 ? `${prefix}${reffyspecBlock}\n\n${trimmedSuffix}` : `${prefix}${reffyspecBlock}\n`;
  }

  if (content.includes(OPENSPEC_START) && content.includes(OPENSPEC_END)) {
    const prefix = content.split(OPENSPEC_START)[0] ?? "";
    const suffix = content.split(OPENSPEC_END, 2)[1] ?? "";
    const trimmedSuffix = suffix.trimStart();
    return trimmedSuffix.length > 0 ? `${prefix}${reffyspecBlock}\n\n${trimmedSuffix}` : `${prefix}${reffyspecBlock}\n`;
  }

  return content.trim().length > 0 ? `${content.trimEnd()}\n\n${reffyspecBlock}\n` : `${reffyspecBlock}\n`;
}

async function initAgents(
  repoRoot: string,
): Promise<{ root_agents_path: string; reffy_agents_path: string; reffyspec_agents_path: string }> {
  const refsDirName = DEFAULT_REFS_DIRNAME;
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  const reffyAgentsPath = path.join(repoRoot, refsDirName, "AGENTS.md");
  const reffyspecAgentsPath = path.join(repoRoot, DEFAULT_PLANNING_DIRNAME, "AGENTS.md");
  let content = "";
  try {
    content = await fs.readFile(agentsPath, "utf8");
  } catch {
    content = "";
  }

  const updated = upsertPlanningBlock(upsertReffyBlockForDir(content, refsDirName));
  await fs.mkdir(path.dirname(reffyAgentsPath), { recursive: true });
  await fs.mkdir(path.dirname(reffyspecAgentsPath), { recursive: true });
  await fs.writeFile(agentsPath, updated, "utf8");
  await fs.writeFile(reffyAgentsPath, buildReffyAgentsContent(refsDirName), "utf8");
  await fs.writeFile(reffyspecAgentsPath, buildReffySpecAgentsContent(), "utf8");
  return { root_agents_path: agentsPath, reffy_agents_path: reffyAgentsPath, reffyspec_agents_path: reffyspecAgentsPath };
}

function pathExists(targetPath: string): boolean {
  return existsSync(targetPath);
}

function isDirectory(targetPath: string): boolean {
  try {
    return statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function discoverRepoRoot(startDir: string): string {
  let current = path.resolve(startDir);

  while (true) {
    if (looksLikeRefsDir(current)) {
      return path.dirname(current);
    }

    if (isDirectory(path.join(current, DEFAULT_REFS_DIRNAME)) || isDirectory(path.join(current, ".references"))) {
      return current;
    }

    if (pathExists(path.join(current, "AGENTS.md")) || pathExists(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }
    current = parent;
  }
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
  return discoverRepoRoot(process.cwd());
}

type OutputMode = "text" | "json";
type DiagramFormat = "svg" | "ascii";

interface DiagramCliArgs {
  repoRoot: string;
  inputPath?: string;
  stdin: boolean;
  format: DiagramFormat;
  outputPath?: string;
  theme?: string;
  bg?: string;
  fg?: string;
  line?: string;
  accent?: string;
  muted?: string;
  surface?: string;
  border?: string;
  font?: string;
}

type DiagramStringOptionKey = "theme" | "bg" | "fg" | "line" | "accent" | "muted" | "surface" | "border" | "font";

interface PlanCliArgs {
  repoRoot: string;
  changeId: string;
  title?: string;
  artifactFilters: string[];
  includeAllArtifacts: boolean;
  overwrite: boolean;
}

function getPlanPositionalArgs(argv: string[]): string[] {
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--repo" || arg === "--output" || arg === "--change-id" || arg === "--title" || arg === "--artifacts") {
      i += 1;
      continue;
    }
    if (
      arg.startsWith("--repo=") ||
      arg.startsWith("--output=") ||
      arg.startsWith("--change-id=") ||
      arg.startsWith("--title=") ||
      arg.startsWith("--artifacts=") ||
      arg === "--json" ||
      arg === "--all" ||
      arg === "--force"
    ) {
      continue;
    }
    if (arg.startsWith("--")) continue;
    positionals.push(arg);
  }

  return positionals;
}

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

function printBanner(mode: OutputMode): void {
  if (mode === "text") {
    console.log(REFFY_ASCII);
    console.log("");
  }
}

function shouldPrintBootstrapOnboarding(workspaceCreated: boolean, workspaceMigrated: boolean, planningCreated: boolean, planningMigrated: boolean): boolean {
  return workspaceCreated || workspaceMigrated || planningCreated || planningMigrated;
}

function printBootstrapOnboarding(): void {
  console.log("");
  console.log("Next step for your agent harness:");
  console.log("Copy and paste this into your conversation with your chosen agent:");
  console.log("");
  console.log(BOOTSTRAP_AGENT_INSTRUCTION);
}

async function runSetupCommand(
  commandName: "init" | "bootstrap",
  output: OutputMode,
  repoRoot: string,
): Promise<number> {
  const workspace = await prepareCanonicalWorkspace(repoRoot);
  const planning = await prepareCanonicalPlanningLayout(repoRoot);
  const agents = await initAgents(repoRoot);
  const store = new ReferencesStore(repoRoot);
  const reindex = await store.reindexArtifacts();
  const payload = {
    status: "ok",
    command: commandName,
    workspace_mode: workspace.state.mode,
    migrated_workspace: workspace.migrated,
    created_workspace: workspace.created,
    planning_mode: planning.state.mode,
    migrated_planning_layout: planning.migrated,
    created_planning_layout: planning.created,
    ...agents,
    refs_dir: store.refsDir,
    manifest_path: store.manifestPath,
    reindex,
  };

  if (output === "json") {
    printResult(output, payload);
    return 0;
  }

  if (workspace.message) {
    console.log(workspace.message);
  }
  if (planning.message) {
    console.log(planning.message);
  }
  console.log(`${commandName === "init" ? "Initialized" : "Bootstrapped"} ${store.refsDir}`);
  console.log(`Updated ${agents.root_agents_path}`);
  console.log(`Updated ${agents.reffy_agents_path}`);
  console.log(`Updated ${agents.reffyspec_agents_path}`);
  console.log(`Reindex: added=${String(reindex.added)} removed=${String(reindex.removed)} total=${String(reindex.total)}`);
  if (shouldPrintBootstrapOnboarding(workspace.created, workspace.migrated, planning.created, planning.migrated)) {
    printBootstrapOnboarding();
  }
  return 0;
}

function usage(): string {
  return [
    "Usage: reffy <command> [--repo PATH] [--output text|json]",
    "",
    "Flags:",
    "  --version  Print the installed reffy package version.",
    "",
    "Commands:",
    "  init       Run the canonical first-run setup flow and refresh managed instructions.",
    "  bootstrap  Compatibility alias for init.",
    "  migrate    Migrate a legacy .references workspace to the canonical .reffy layout.",
    "  doctor     Diagnose required Reffy setup and optional tool availability.",
    "  reindex    Scan .reffy/artifacts and add missing files to manifest.",
    "  validate   Validate .reffy/manifest.json against manifest v1 contract.",
    "  summarize  Generate a read-only summary of indexed Reffy artifacts.",
    "  plan       Generate and manage ReffySpec planning scaffolds from indexed Reffy artifacts.",
    "  spec       Inspect current specs from the ReffySpec layout.",
    "  diagram    Render Mermaid diagrams (supports SVG and ASCII).",
  ].join("\n");
}

function diagramUsage(): string {
  return [
    "Usage: reffy diagram render [--repo PATH] [--input PATH|--stdin] [--format svg|ascii] [--output PATH]",
    "",
    "Options:",
    "  --input PATH      Read Mermaid (or ReffySpec spec.md) from file",
    "  --stdin           Read Mermaid text from stdin",
    "  --format VALUE    Output format: svg (default) or ascii",
    "  --output PATH     Write rendered result to file instead of stdout",
    "  --theme NAME      Apply built-in SVG theme (beautiful-mermaid)",
    "  --bg HEX          SVG color override for background",
    "  --fg HEX          SVG color override for foreground",
    "  --line HEX        SVG color override for connector lines",
    "  --accent HEX      SVG color override for accents/arrowheads",
    "  --muted HEX       SVG color override for secondary text",
    "  --surface HEX     SVG color override for node surfaces",
    "  --border HEX      SVG color override for node borders",
    "  --font NAME       SVG font family override",
  ].join("\n");
}

function specUsage(): string {
  return [
    "Usage:",
    "  reffy spec list [--repo PATH] [--output text|json]",
    "  reffy spec show <spec-id> [--repo PATH] [--output text|json]",
  ].join("\n");
}

function planUsage(): string {
  return [
    "Usage:",
    "  reffy plan create --change-id ID [--repo PATH] [--artifacts file1.md,file2.md|--all] [--title TEXT]",
    "  reffy plan validate <change-id> [--repo PATH] [--output text|json]",
    "  reffy plan list [--repo PATH] [--output text|json]",
    "  reffy plan show <change-id> [--repo PATH] [--output text|json]",
    "  reffy plan archive <change-id> [--repo PATH] [--output text|json]",
    "",
    "Options:",
    `  --change-id ID     ${DEFAULT_PLANNING_DIRNAME} change id to create`,
    "  --title TEXT       Human-readable proposal title",
    "  --artifacts LIST   Comma-separated artifact filenames or ids to link",
    "  --all              Use all indexed artifacts as planning inputs",
    "  --force            Overwrite an existing non-empty change directory",
  ].join("\n");
}

function parseDiagramArgs(argv: string[]): DiagramCliArgs {
  const repoRoot = parseRepoArg(argv);
  const args: DiagramCliArgs = {
    repoRoot,
    stdin: false,
    format: "svg",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--repo") {
      i += 1;
      continue;
    }
    if (arg.startsWith("--repo=")) continue;

    if (arg === "--stdin") {
      args.stdin = true;
      continue;
    }
    if (arg === "--input") {
      const value = argv[i + 1];
      if (!value) throw new Error("--input requires a path");
      args.inputPath = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--input=")) {
      const value = arg.split("=", 2)[1];
      if (!value) throw new Error("--input requires a path");
      args.inputPath = value;
      continue;
    }
    if (arg === "--output") {
      const value = argv[i + 1];
      if (!value) throw new Error("--output requires a path");
      args.outputPath = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--output=")) {
      const value = arg.split("=", 2)[1];
      if (!value) throw new Error("--output requires a path");
      args.outputPath = value;
      continue;
    }
    if (arg === "--format") {
      const value = argv[i + 1];
      if (!value) throw new Error("--format requires a value: svg|ascii");
      if (value !== "svg" && value !== "ascii") throw new Error(`Unsupported format: ${value}. Valid formats: svg, ascii`);
      args.format = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--format=")) {
      const value = arg.split("=", 2)[1];
      if (value !== "svg" && value !== "ascii") throw new Error(`Unsupported format: ${value}. Valid formats: svg, ascii`);
      args.format = value;
      continue;
    }

    const keyMap: Record<string, DiagramStringOptionKey> = {
      "--theme": "theme",
      "--bg": "bg",
      "--fg": "fg",
      "--line": "line",
      "--accent": "accent",
      "--muted": "muted",
      "--surface": "surface",
      "--border": "border",
      "--font": "font",
    };

    const directKey = keyMap[arg];
    if (directKey) {
      const value = argv[i + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      args[directKey] = value;
      i += 1;
      continue;
    }

    const inline = Object.entries(keyMap).find(([flag]) => arg.startsWith(`${flag}=`));
    if (inline) {
      const [flag, key] = inline;
      const value = arg.slice(flag.length + 1);
      if (!value) throw new Error(`${flag} requires a value`);
      args[key] = value;
      continue;
    }

    throw new Error(`Unknown diagram option: ${arg}`);
  }

  return args;
}

function parsePlanArgs(argv: string[]): PlanCliArgs {
  const repoRoot = parseRepoArg(argv);
  const args: PlanCliArgs = {
    repoRoot,
    changeId: "",
    artifactFilters: [],
    includeAllArtifacts: false,
    overwrite: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--repo") {
      i += 1;
      continue;
    }
    if (arg.startsWith("--repo=")) continue;
    if (arg === "--json") continue;
    if (arg === "--output") {
      i += 1;
      continue;
    }
    if (arg.startsWith("--output=")) continue;

    if (arg === "--change-id") {
      const value = argv[i + 1];
      if (!value) throw new Error("--change-id requires a value");
      args.changeId = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--change-id=")) {
      args.changeId = arg.split("=", 2)[1] ?? "";
      continue;
    }
    if (arg === "--title") {
      const value = argv[i + 1];
      if (!value) throw new Error("--title requires a value");
      args.title = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--title=")) {
      args.title = arg.split("=", 2)[1];
      continue;
    }
    if (arg === "--artifacts") {
      const value = argv[i + 1];
      if (!value) throw new Error("--artifacts requires a comma-separated value");
      args.artifactFilters = value.split(",").map((entry) => entry.trim()).filter(Boolean);
      i += 1;
      continue;
    }
    if (arg.startsWith("--artifacts=")) {
      const value = arg.split("=", 2)[1] ?? "";
      args.artifactFilters = value.split(",").map((entry) => entry.trim()).filter(Boolean);
      continue;
    }
    if (arg === "--all") {
      args.includeAllArtifacts = true;
      continue;
    }
    if (arg === "--force") {
      args.overwrite = true;
      continue;
    }

    throw new Error(`Unknown plan option: ${arg}`);
  }

  if (!args.changeId) {
    throw new Error("--change-id is required");
  }

  return args;
}

function printSection(title: string, values: string[]): void {
  console.log(`${title}:`);
  if (values.length === 0) {
    console.log("- (none)");
    return;
  }
  for (const value of values) {
    console.log(`- ${value}`);
  }
}

async function main(): Promise<number> {
  const [, , command, ...rest] = process.argv;

  if (!command || command === "--help" || command === "-h") {
    console.error(usage());
    return command ? 0 : 1;
  }

  if (command === "--version") {
    console.log(packageVersion);
    return 0;
  }

  if (command === "diagram") {
    const [subcommand, ...diagramArgs] = rest;
    if (!subcommand || subcommand === "--help" || subcommand === "-h") {
      console.error(diagramUsage());
      return 1;
    }
    if (subcommand !== "render") {
      console.error(`Unknown diagram subcommand: ${subcommand}`);
      console.error(diagramUsage());
      return 1;
    }

    const parsed = parseDiagramArgs(diagramArgs);
    await prepareCanonicalPlanningLayout(parsed.repoRoot);
    const rendered = await renderDiagram({
      repoRoot: parsed.repoRoot,
      inputPath: parsed.inputPath,
      stdin: parsed.stdin,
      format: parsed.format,
      outputPath: parsed.outputPath,
      theme: parsed.theme,
      bg: parsed.bg,
      fg: parsed.fg,
      line: parsed.line,
      accent: parsed.accent,
      muted: parsed.muted,
      surface: parsed.surface,
      border: parsed.border,
      font: parsed.font,
    });

    if (parsed.outputPath) {
      console.log(`Wrote ${parsed.format} diagram to ${path.isAbsolute(parsed.outputPath) ? parsed.outputPath : path.join(parsed.repoRoot, parsed.outputPath)}`);
      return 0;
    }

    process.stdout.write(rendered.content);
    if (!rendered.content.endsWith("\n")) {
      process.stdout.write("\n");
    }
    return 0;
  }

  if (command === "plan") {
    const [subcommand, ...planArgs] = rest;
    if (!subcommand || subcommand === "--help" || subcommand === "-h") {
      console.error(planUsage());
      return 1;
    }

    if (subcommand === "create") {
      const output = parseOutputMode(planArgs);
      const parsed = parsePlanArgs(planArgs);
      await prepareCanonicalPlanningLayout(parsed.repoRoot);
      const store = new ReferencesStore(parsed.repoRoot);
      const validation = await store.validateManifest();
      if (!validation.ok) {
        const payload = { status: "error", command: "plan", subcommand: "create", ...validation };
        if (output === "json") {
          printResult(output, payload);
        } else {
          console.error(`Cannot create plan: manifest invalid (${String(validation.errors.length)} error(s))`);
        }
        return 1;
      }

      const result = await createPlanScaffold(store, {
        changeId: parsed.changeId,
        title: parsed.title,
        artifactFilters: parsed.artifactFilters,
        includeAllArtifacts: parsed.includeAllArtifacts,
        overwrite: parsed.overwrite,
      });
      const payload = { status: "ok", command: "plan", subcommand: "create", ...result };
      if (output === "json") {
        printResult(output, payload);
      } else {
        console.log(`Created ${result.change_dir}`);
        console.log(`Artifacts linked: ${String(result.linked_artifacts)}`);
        for (const file of result.written_files) {
          console.log(`- ${file}`);
        }
      }
      return 0;
    }

    const output = parseOutputMode(planArgs);
    const repoRoot = parseRepoArg(planArgs);
    await prepareCanonicalPlanningLayout(repoRoot);
    const positionals = getPlanPositionalArgs(planArgs);

    if (subcommand === "validate") {
      const changeId = positionals[0];
      if (!changeId) {
        console.error("reffy plan validate requires a change id");
        console.error(planUsage());
        return 1;
      }

      const result = await validatePlanningChange(repoRoot, changeId);
      const payload = { status: result.ok ? "ok" : "error", command: "plan", subcommand: "validate", ...result };
      if (output === "json") {
        printResult(output, payload);
      } else if (result.ok) {
        console.log(`Change "${changeId}" is valid`);
        console.log(`Tasks: ${String(result.task_status.completed)}/${String(result.task_status.total)}`);
        console.log(`Delta specs: ${String(result.delta_count)}`);
        for (const warning of result.warnings) {
          console.log(`warn: ${warning}`);
        }
      } else {
        console.error(`Change "${changeId}" has issues`);
        for (const error of result.errors) {
          console.error(`error: ${error}`);
        }
        for (const warning of result.warnings) {
          console.error(`warn: ${warning}`);
        }
      }
      return result.ok ? 0 : 1;
    }

    if (subcommand === "list") {
      const changes = await listPlanningChanges(repoRoot);
      const payload = { status: "ok", command: "plan", subcommand: "list", changes };
      if (output === "json") {
        printResult(output, payload);
      } else if (changes.length === 0) {
        console.log("Changes:");
        console.log("- (none)");
      } else {
        console.log("Changes:");
        for (const change of changes) {
          console.log(
            `- ${change.id} - ${change.title} [deltas ${String(change.delta_count)}] [tasks ${String(change.task_status.completed)}/${String(change.task_status.total)}]`,
          );
        }
      }
      return 0;
    }

    if (subcommand === "show") {
      const changeId = positionals[0];
      if (!changeId) {
        console.error("reffy plan show requires a change id");
        console.error(planUsage());
        return 1;
      }

      const result = await showPlanningChange(repoRoot, changeId);
      const payload = { status: "ok", command: "plan", subcommand: "show", change: result };
      if (output === "json") {
        printResult(output, payload);
      } else {
        console.log(`# ${result.title}`);
        console.log("");
        console.log(result.proposal.trim());
        console.log("");
        console.log("## Tasks");
        console.log(result.tasks.trim());
        if (result.design) {
          console.log("");
          console.log("## Design");
          console.log(result.design.trim());
        }
        if (result.specs.length > 0) {
          console.log("");
          console.log("## Specs");
          for (const spec of result.specs) {
            console.log(`### ${spec.capability}`);
            console.log(spec.content.trim());
          }
        }
      }
      return 0;
    }

    if (subcommand === "archive") {
      const changeId = positionals[0];
      if (!changeId) {
        console.error("reffy plan archive requires a change id");
        console.error(planUsage());
        return 1;
      }

      const result = await archivePlanningChange(repoRoot, changeId);
      const payload = { status: "ok", command: "plan", subcommand: "archive", ...result };
      if (output === "json") {
        printResult(output, payload);
      } else {
        console.log(`Archived ${changeId} to ${result.archive_dir}`);
        console.log(`Updated specs: ${String(result.updated_specs.length)}`);
        console.log(`Linked artifacts updated: ${String(result.linked_artifacts)}`);
      }
      return 0;
    }

    {
      console.error(`Unknown plan subcommand: ${subcommand}`);
      console.error(planUsage());
      return 1;
    }
  }

  if (command === "spec") {
    const [subcommand, ...specArgs] = rest;
    if (!subcommand || subcommand === "--help" || subcommand === "-h") {
      console.error(specUsage());
      return 1;
    }

    const output = parseOutputMode(specArgs);
    const repoRoot = parseRepoArg(specArgs);
    await prepareCanonicalPlanningLayout(repoRoot);
    const positionals = getPlanPositionalArgs(specArgs);

    if (subcommand === "list") {
      const specs = await listSpecs(repoRoot);
      const payload = { status: "ok", command: "spec", subcommand: "list", specs };
      if (output === "json") {
        printResult(output, payload);
      } else if (specs.length === 0) {
        console.log("Specs:");
        console.log("- (none)");
      } else {
        console.log("Specs:");
        for (const spec of specs) {
          console.log(`- ${spec.id} - ${spec.title} [requirements ${String(spec.requirement_count)}]`);
        }
      }
      return 0;
    }

    if (subcommand === "show") {
      const specId = positionals[0];
      if (!specId) {
        console.error("reffy spec show requires a spec id");
        console.error(specUsage());
        return 1;
      }

      const result = await showSpec(repoRoot, specId);
      const payload = { status: "ok", command: "spec", subcommand: "show", spec: result };
      if (output === "json") {
        printResult(output, payload);
      } else {
        console.log(`# ${result.title}`);
        if (result.purpose) {
          console.log("");
          console.log(`Purpose: ${result.purpose}`);
        }
        console.log("");
        console.log(result.spec.trim());
        if (result.design) {
          console.log("");
          console.log("## Design");
          console.log(result.design.trim());
        }
      }
      return 0;
    }

    console.error(`Unknown spec subcommand: ${subcommand}`);
    console.error(specUsage());
    return 1;
  }

  const output = parseOutputMode(rest);

  if (command === "init") {
    printBanner(output);
    const repoRoot = parseRepoArg(rest);
    return await runSetupCommand("init", output, repoRoot);
  }

  if (command === "bootstrap") {
    const repoRoot = parseRepoArg(rest);
    return await runSetupCommand("bootstrap", output, repoRoot);
  }

  if (command === "migrate") {
    const repoRoot = parseRepoArg(rest);
    const workspace = await prepareCanonicalWorkspace(repoRoot);
    const planning = await prepareCanonicalPlanningLayout(repoRoot);
    const agents = await initAgents(repoRoot);
    const payload = {
      status: "ok",
      command: "migrate",
      workspace_mode: workspace.state.mode,
      migrated_workspace: workspace.migrated,
      created_workspace: workspace.created,
      planning_mode: planning.state.mode,
      migrated_planning_layout: planning.migrated,
      created_planning_layout: planning.created,
      refs_dir: workspace.state.canonicalDir,
      ...agents,
    };
    if (output === "json") {
      printResult(output, payload);
    } else {
      console.log(workspace.message ?? `Workspace ready at ${workspace.state.canonicalDir}`);
      if (planning.message) {
        console.log(planning.message);
      }
      console.log(`Updated ${agents.root_agents_path}`);
      console.log(`Updated ${agents.reffy_agents_path}`);
      console.log(`Updated ${agents.reffyspec_agents_path}`);
    }
    return 0;
  }

  if (command === "reindex") {
    const repoRoot = parseRepoArg(rest);
    await prepareCanonicalPlanningLayout(repoRoot);
    const store = new ReferencesStore(repoRoot);
    const reindex = await store.reindexArtifacts();
    const payload = { status: "ok", command: "reindex", ...reindex };
    if (output === "json") {
      printResult(output, payload);
    } else {
      console.log(
        `Reindex complete: added=${String(reindex.added)} removed=${String(reindex.removed)} total=${String(reindex.total)}`,
      );
    }
    return 0;
  }

  if (command === "doctor") {
    const repoRoot = parseRepoArg(rest);
    await prepareCanonicalPlanningLayout(repoRoot);
    const report = await runDoctor(repoRoot);
    const status = report.summary.required_failed > 0 ? "error" : "ok";
    const payload = { status, command: "doctor", ...report };
    if (output === "json") {
      printResult(output, payload);
    } else {
      const required = report.checks.filter((check) => check.level === "required");
      const optional = report.checks.filter((check) => check.level === "optional");

      console.log("Required Checks:");
      for (const check of required) {
        console.log(`- ${check.ok ? "PASS" : "FAIL"} ${check.id}: ${check.message}`);
      }
      console.log("");
      console.log("Optional Checks:");
      for (const check of optional) {
        console.log(`- ${check.ok ? "PASS" : "WARN"} ${check.id}: ${check.message}`);
      }
      console.log("");
      console.log(
        `Summary: required_failed=${String(report.summary.required_failed)} optional_failed=${String(report.summary.optional_failed)}`,
      );
    }
    return status === "ok" ? 0 : 1;
  }

  if (command === "validate") {
    const repoRoot = parseRepoArg(rest);
    await prepareCanonicalPlanningLayout(repoRoot);
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

  if (command === "summarize") {
    const repoRoot = parseRepoArg(rest);
    await prepareCanonicalPlanningLayout(repoRoot);
    const store = new ReferencesStore(repoRoot);
    const validation = await store.validateManifest();
    if (!validation.ok) {
      const payload = { status: "error", command: "summarize", ...validation };
      if (output === "json") {
        printResult(output, payload);
      } else {
        console.error(`Cannot summarize: manifest invalid (${String(validation.errors.length)} error(s))`);
        for (const error of validation.errors) {
          console.error(`error: ${error}`);
        }
      }
      return 1;
    }

    const summary = await summarizeArtifacts(store);
    const payload = { status: "ok", command: "summarize", ...summary };
    if (output === "json") {
      printResult(output, payload);
    } else {
      printSection("Themes", summary.themes);
      console.log("");
      printSection("Open Questions", summary.open_questions);
      console.log("");
      printSection("Candidate Changes", summary.candidate_changes);
      console.log("");
      console.log("Suggested Reffy References:");
      if (summary.suggested_reffy_references.length === 0) {
        console.log("- (none)");
      } else {
        for (const reference of summary.suggested_reffy_references) {
          console.log(`- ${reference.filename} - ${reference.reason}`);
        }
      }
    }
    return 0;
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
