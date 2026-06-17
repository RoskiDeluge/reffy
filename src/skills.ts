import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveRefsDir } from "./refs-paths.js";

export const SKILLS_DIRNAME = "skills";
export const SKILL_ENTRY_FILENAME = "SKILL.md";

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  triggers: string[];
  commands: string[];
  managed: boolean;
}

export interface SkillDescriptor {
  name: string;
  description: string;
  triggers: string[];
  commands: string[];
  managed: boolean;
  path: string;
}

export interface SkillRecord extends SkillDescriptor {
  dir: string;
  entryPath: string;
  body: string;
}

export interface SkillValidationIssue {
  skill: string;
  field?: string;
  message: string;
}

export interface SkillValidationResult {
  ok: boolean;
  issues: SkillValidationIssue[];
  skill_count: number;
}

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function resolveSkillsDir(repoRoot: string): string {
  return path.join(resolveRefsDir(repoRoot), SKILLS_DIRNAME);
}

export function isKebabCase(value: string): boolean {
  return KEBAB_CASE.test(value);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function parseScalar(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseInlineList(raw: string): string[] {
  const inner = raw.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (inner.trim() === "") {
    return [];
  }
  return inner
    .split(",")
    .map((item) => parseScalar(item))
    .filter((item) => item.length > 0);
}

/**
 * Parse the `SKILL.md` frontmatter contract. Supports a leading `---` fenced
 * block with scalar fields (`name`, `description`, `managed`) and list fields
 * (`triggers`, `commands`) in either inline (`[a, b]`) or block (`- a`) form.
 * Returns the parsed frontmatter and the remaining markdown body.
 */
export function parseSkillFile(content: string): { frontmatter: SkillFrontmatter; body: string } {
  const normalized = content.replace(/^﻿/, "");
  const frontmatter: SkillFrontmatter = { triggers: [], commands: [], managed: false };

  const lines = normalized.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return { frontmatter, body: normalized };
  }

  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { frontmatter, body: normalized };
  }

  let currentListKey: "triggers" | "commands" | null = null;
  for (let i = 1; i < end; i += 1) {
    const line = lines[i];
    if (line.trim() === "") {
      continue;
    }

    const blockItem = /^\s*-\s+(.*)$/.exec(line);
    if (blockItem && currentListKey) {
      const value = parseScalar(blockItem[1]);
      if (value.length > 0) {
        frontmatter[currentListKey].push(value);
      }
      continue;
    }

    const keyMatch = /^([A-Za-z_][A-Za-z0-9_]*):(.*)$/.exec(line);
    if (!keyMatch) {
      continue;
    }
    const key = keyMatch[1].trim();
    const rawValue = keyMatch[2].trim();
    currentListKey = null;

    if (key === "name") {
      frontmatter.name = parseScalar(rawValue);
    } else if (key === "description") {
      frontmatter.description = parseScalar(rawValue);
    } else if (key === "managed") {
      frontmatter.managed = parseScalar(rawValue).toLowerCase() === "true";
    } else if (key === "triggers" || key === "commands") {
      if (rawValue.startsWith("[")) {
        frontmatter[key] = parseInlineList(rawValue);
      } else if (rawValue === "") {
        currentListKey = key;
      } else {
        frontmatter[key] = [parseScalar(rawValue)];
      }
    }
  }

  const body = lines.slice(end + 1).join("\n").replace(/^\n+/, "");
  return { frontmatter, body };
}

function toDescriptor(record: { frontmatter: SkillFrontmatter; dirName: string; relPath: string }): SkillDescriptor {
  const { frontmatter, dirName, relPath } = record;
  return {
    name: frontmatter.name ?? dirName,
    description: frontmatter.description ?? "",
    triggers: frontmatter.triggers,
    commands: frontmatter.commands,
    managed: frontmatter.managed,
    path: relPath,
  };
}

/**
 * Discover skills by scanning `.reffy/skills/` for directories containing a
 * `SKILL.md` entry file. Skills are filesystem-discovered and never indexed in
 * `manifest.json`.
 */
export async function discoverSkills(repoRoot: string): Promise<SkillRecord[]> {
  const skillsDir = resolveSkillsDir(repoRoot);
  const entries = await fs.readdir(skillsDir, { withFileTypes: true }).catch(() => []);
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

  const records: SkillRecord[] = [];
  for (const dirName of dirs) {
    const dir = path.join(skillsDir, dirName);
    const entryPath = path.join(dir, SKILL_ENTRY_FILENAME);
    if (!(await pathExists(entryPath))) {
      continue;
    }
    const content = await fs.readFile(entryPath, "utf8");
    const { frontmatter, body } = parseSkillFile(content);
    const relPath = path.relative(repoRoot, entryPath);
    const descriptor = toDescriptor({ frontmatter, dirName, relPath });
    records.push({ ...descriptor, dir, entryPath, body });
  }
  return records;
}

export async function findSkill(repoRoot: string, name: string): Promise<SkillRecord | null> {
  const skills = await discoverSkills(repoRoot);
  return skills.find((skill) => skill.name === name) ?? null;
}

/**
 * Validate every skill (or one named skill) against the frontmatter contract:
 * required fields, non-empty triggers, unique names, and kebab-case directory
 * names matching `name`.
 */
export async function validateSkills(repoRoot: string, name?: string): Promise<SkillValidationResult> {
  const skillsDir = resolveSkillsDir(repoRoot);
  const issues: SkillValidationIssue[] = [];

  const entries = await fs.readdir(skillsDir, { withFileTypes: true }).catch(() => []);
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((dirName) => name === undefined || dirName === name)
    .sort();

  const seenNames = new Map<string, string>();

  for (const dirName of dirs) {
    const label = dirName;
    const entryPath = path.join(skillsDir, dirName, SKILL_ENTRY_FILENAME);
    if (!(await pathExists(entryPath))) {
      issues.push({ skill: label, message: `${SKILL_ENTRY_FILENAME} is missing` });
      continue;
    }

    const content = await fs.readFile(entryPath, "utf8");
    const { frontmatter } = parseSkillFile(content);

    if (!frontmatter.name || frontmatter.name.trim() === "") {
      issues.push({ skill: label, field: "name", message: "frontmatter is missing required field: name" });
    } else {
      if (frontmatter.name !== dirName) {
        issues.push({
          skill: label,
          field: "name",
          message: `name "${frontmatter.name}" does not match directory name "${dirName}"`,
        });
      }
      const prior = seenNames.get(frontmatter.name);
      if (prior) {
        issues.push({
          skill: label,
          field: "name",
          message: `duplicate skill name "${frontmatter.name}" (also defined in "${prior}")`,
        });
      } else {
        seenNames.set(frontmatter.name, dirName);
      }
    }

    if (!isKebabCase(dirName)) {
      issues.push({ skill: label, message: `directory name "${dirName}" is not kebab-case` });
    }

    if (!frontmatter.description || frontmatter.description.trim() === "") {
      issues.push({ skill: label, field: "description", message: "frontmatter is missing required field: description" });
    }

    if (frontmatter.triggers.length === 0) {
      issues.push({ skill: label, field: "triggers", message: "frontmatter field triggers must contain at least one entry" });
    }
  }

  if (name !== undefined && dirs.length === 0) {
    issues.push({ skill: name, message: `skill "${name}" was not found` });
  }

  return { ok: issues.length === 0, issues, skill_count: dirs.length };
}

// --- Command-reference staleness -------------------------------------------

/**
 * The canonical command table of the installed CLI. `reffy doctor` cross-checks
 * each skill's declared `commands` against this table and warns on drift.
 */
export const KNOWN_COMMANDS: readonly string[] = [
  "reffy init",
  "reffy bootstrap",
  "reffy migrate",
  "reffy doctor",
  "reffy reindex",
  "reffy validate",
  "reffy summarize",
  "reffy plan create",
  "reffy plan validate",
  "reffy plan list",
  "reffy plan show",
  "reffy plan archive",
  "reffy spec list",
  "reffy spec show",
  "reffy remote init",
  "reffy remote status",
  "reffy remote push",
  "reffy remote ls",
  "reffy remote cat",
  "reffy remote snapshot",
  "reffy remote workspace create",
  "reffy remote workspace get",
  "reffy remote workspace delete",
  "reffy remote project register",
  "reffy remote project list",
  "reffy diagram render",
  "reffy skill list",
  "reffy skill show",
  "reffy skill create",
  "reffy skill validate",
];

/** Reduce a declared command string to its leading non-flag tokens. */
function commandHead(command: string): string {
  const tokens = command.trim().split(/\s+/);
  const head: string[] = [];
  for (const token of tokens) {
    if (token.startsWith("-")) {
      break;
    }
    head.push(token);
  }
  return head.join(" ");
}

export function isKnownCommand(command: string): boolean {
  const head = commandHead(command);
  if (head === "") {
    return false;
  }
  return KNOWN_COMMANDS.some((known) => head === known || head.startsWith(`${known} `));
}

export interface SkillCommandDrift {
  skill: string;
  command: string;
}

export async function findCommandDrift(repoRoot: string): Promise<SkillCommandDrift[]> {
  const skills = await discoverSkills(repoRoot);
  const drift: SkillCommandDrift[] = [];
  for (const skill of skills) {
    for (const command of skill.commands) {
      if (!isKnownCommand(command)) {
        drift.push({ skill: skill.name, command });
      }
    }
  }
  return drift;
}

// --- Scaffolding -----------------------------------------------------------

interface ManagedSkillDefinition {
  name: string;
  description: string;
  triggers: string[];
  commands: string[];
  body: string;
}

function renderSkillFile(def: { name: string; description: string; triggers: string[]; commands: string[]; managed: boolean; body: string }): string {
  const lines = ["---"];
  lines.push(`name: ${def.name}`);
  lines.push(`description: ${def.description}`);
  lines.push(`triggers: [${def.triggers.map((t) => JSON.stringify(t)).join(", ")}]`);
  lines.push(`commands: [${def.commands.map((c) => JSON.stringify(c)).join(", ")}]`);
  lines.push(`managed: ${def.managed ? "true" : "false"}`);
  lines.push("---");
  lines.push("");
  lines.push(def.body.trim());
  lines.push("");
  return lines.join("\n");
}

export const MANAGED_SKILLS: readonly ManagedSkillDefinition[] = [
  {
    name: "create-artifact",
    description: "Capture ideation context as a Reffy artifact and register it in the manifest.",
    triggers: ["new artifact", "capture idea", "add note", "reindex"],
    commands: ["reffy reindex", "reffy validate"],
    body: `## When to use this skill
Use this when you have raw ideation, exploration, or research context to capture before any formal planning.

## Steps
1. Write the context as a markdown file under \`.reffy/artifacts/\` with a clear, stable, kebab-case filename.
2. Run \`reffy reindex\` to add the new file to \`.reffy/manifest.json\`.
3. Run \`reffy validate\` to confirm the manifest still satisfies the v1 contract.
4. Confirm the artifact appears in the manifest with the expected name and id.

## Failure modes
- If \`reffy validate\` reports an invalid manifest, fix the reported entry before continuing — do not hand-edit ids.
- Keep artifacts exploratory; do not duplicate full proposal or spec content here.`,
  },
  {
    name: "create-change",
    description: "Turn one or more ideation artifacts into a ReffySpec change proposal.",
    triggers: ["new change", "plan create", "turn artifact into proposal"],
    commands: ["reffy plan create", "reffy plan validate"],
    body: `## When to use this skill
Use this when ideation has converged and you are ready to scaffold a formal ReffySpec change from one or more artifacts.

## Steps
1. Pick the source artifacts in \`.reffy/artifacts/\` that inform the change.
2. Run \`reffy plan create --change-id <kebab-id> --artifacts <files> --title "<title>"\`.
3. Fill in the scaffolded \`proposal.md\`, \`design.md\`, \`tasks.md\`, and \`specs/<capability>/spec.md\` deltas.
   Each delta requirement needs at least one \`#### Scenario:\`.
4. Run \`reffy plan validate <change-id>\` and resolve every error before implementing.

## Failure modes
- If validation reports a missing scenario block, add at least one scenario to each requirement.
- Use a unique verb-led, kebab-case \`change-id\`.`,
  },
  {
    name: "archive-change",
    description: "Complete and archive a shipped ReffySpec change, merging its delta into canonical specs.",
    triggers: ["archive change", "ship change", "plan archive", "merge spec"],
    commands: ["reffy plan validate", "reffy plan archive", "reffy spec show"],
    body: `## When to use this skill
Use this once a change is implemented and verified and you want to fold its spec delta into canonical truth.

## Steps
1. Confirm every task in \`tasks.md\` is checked off.
2. Run \`reffy plan validate <change-id>\` one last time.
3. Run \`reffy plan archive <change-id>\` to move the change under \`changes/archive/<date>-<change-id>/\` and merge its delta specs.
4. Verify the merge with \`reffy spec show <capability>\`.

## Failure modes
- If archive reports unmerged or conflicting requirements, inspect the delta against the canonical spec before retrying.`,
  },
  {
    name: "supersede-change",
    description: "Represent a pivot, deprecation, or reversal as a new change that supersedes a prior one.",
    triggers: [
      "pivot",
      "change direction",
      "deprecate",
      "wind down",
      "reverse the decision",
      "supersede",
      "replace the approach",
      "abandon",
    ],
    commands: ["reffy plan list", "reffy plan create", "reffy plan validate", "reffy plan archive"],
    body: `## When to use this skill
Use this when a request changes direction rather than adding to it: a pivot, deprecation, wind-down, or reversal of a prior decision. A pivot is not a special object — it is an ordinary change that supersedes another. Never edit or delete an archived change to reverse it; land a new change on top. Canonical \`specs/\` always reflects current truth and the archive stays append-only.

## Steps
1. Run \`reffy plan list\` to identify the prior change-id(s) whose direction this reverses or replaces.
2. Run \`reffy plan create --change-id <kebab-id> --title "<title>"\` for the new change.
3. Author the spec delta with \`REMOVED\`/\`MODIFIED\` requirements (not \`ADDED\`) that retire or rewrite the superseded behavior. The delta is the authoritative record of what changed.
4. In \`proposal.md\`, fill the \`## Supersedes\` section with the prior change-id(s) — a navigational pointer that keeps the lineage explicit.
5. Pair the change with code-removal / migration tasks in \`tasks.md\`.
6. Run \`reffy plan validate <change-id>\`, then \`reffy plan archive <change-id>\` once shipped.

## Failure modes
- If you find yourself wanting to edit an archived change, stop: model the reversal as a new superseding change instead.
- Leaving \`## Supersedes\` as "None" on a genuine pivot loses the lineage; name the prior change-id.
- A pivot whose delta only \`ADDED\`s requirements is probably not actually retiring the old direction — check the canonical spec for what should be \`REMOVED\`/\`MODIFIED\`.`,
  },
  {
    name: "inspect-specs",
    description: "Ground work in current truth by inspecting canonical specs before changing behavior.",
    triggers: ["inspect specs", "current truth", "spec list", "spec show"],
    commands: ["reffy spec list", "reffy spec show"],
    body: `## When to use this skill
Use this before drafting a change or implementing behavior, to confirm what the specs already say.

## Steps
1. Run \`reffy spec list\` to enumerate capabilities and their requirement counts.
2. Run \`reffy spec show <capability>\` to read the requirements and scenarios for a capability.
3. Reference the relevant spec from your proposal or skill rather than restating its requirements.

## Failure modes
- If a capability is missing, it likely needs a new \`ADDED\` delta in a change rather than an edit to canonical specs.`,
  },
  {
    name: "sync-remote",
    description: "Publish and inspect the local .reffy/ workspace on a Paseo-backed remote.",
    triggers: ["remote sync", "push workspace", "paseo", "remote status"],
    commands: ["reffy remote init", "reffy remote status", "reffy remote push", "reffy remote snapshot"],
    body: `## When to use this skill
Use this to link, publish, or inspect the shared remote workspace projection.

## Required environment
- \`PASEO_ENDPOINT\` — the Paseo endpoint URL (never persisted).
- \`PASEO_TOKEN\` — the bearer token (never persisted by the CLI).

Provide them either by exporting them in your shell or by placing them in a
\`.env\` file at the repo root — every \`reffy remote\` command auto-loads \`.env\`
(use \`--env-file PATH\` to point at a different file). Exported shell vars take
precedence over \`.env\`.

## Steps
1. Ensure both values are available via the shell or \`.env\`; the CLI fails fast and names a missing one.
2. First time: \`reffy remote init --provision\` to create the workspace and mint a token. Save the token immediately.
3. \`reffy remote status\` to confirm linkage and identity.
4. \`reffy remote push\` to import the full local \`.reffy/\` tree.
5. \`reffy remote snapshot\` / \`ls\` / \`cat\` to inspect the remote projection.

## Failure modes
- A missing token makes the stored identifiers in \`.reffy/state/remote.json\` inert — set \`PASEO_TOKEN\`.`,
  },
  {
    name: "diagnose",
    description: "Diagnose Reffy workspace health and resolve common failure classes.",
    triggers: ["diagnose", "doctor", "validate", "workspace health"],
    commands: ["reffy doctor", "reffy validate"],
    body: `## When to use this skill
Use this first when a Reffy command misbehaves in an unfamiliar repo.

## Steps
1. Run \`reffy doctor\` for the required/optional check list.
2. Run \`reffy validate\` to confirm the manifest contract.
3. Resolve each failure by class:
   - Missing \`.reffy/\` or \`AGENTS.md\`: run \`reffy init\`.
   - Legacy \`.references/\` workspace: run \`reffy migrate\`.
   - Invalid manifest: fix the reported entry, then re-run \`reffy validate\`.
   - Skill command drift: update the stale skill's \`commands\` list.

## Failure modes
- A non-zero exit from \`reffy doctor\` means a required check failed; address required failures before optional warnings.`,
  },
];

export function isManagedSkillName(name: string): boolean {
  return MANAGED_SKILLS.some((skill) => skill.name === name);
}

export interface SkillScaffoldResult {
  created_dir: boolean;
  written_skills: string[];
  preserved_unmanaged: string[];
}

/**
 * Create `.reffy/skills/` and write the built-in managed skills. Managed skill
 * bodies are (re)written in place on every call; unmanaged skills are never
 * touched.
 */
export async function scaffoldManagedSkills(repoRoot: string): Promise<SkillScaffoldResult> {
  const skillsDir = resolveSkillsDir(repoRoot);
  const created_dir = !(await pathExists(skillsDir));
  await fs.mkdir(skillsDir, { recursive: true });

  const written: string[] = [];
  for (const def of MANAGED_SKILLS) {
    const dir = path.join(skillsDir, def.name);
    await fs.mkdir(dir, { recursive: true });
    const entryPath = path.join(dir, SKILL_ENTRY_FILENAME);
    const content = renderSkillFile({ ...def, managed: true });
    await fs.writeFile(entryPath, content, "utf8");
    written.push(def.name);
  }

  const entries = await fs.readdir(skillsDir, { withFileTypes: true }).catch(() => []);
  const preserved_unmanaged = entries
    .filter((entry) => entry.isDirectory() && !isManagedSkillName(entry.name))
    .map((entry) => entry.name)
    .sort();

  return { created_dir, written_skills: written, preserved_unmanaged };
}

const UNMANAGED_TEMPLATE_BODY = `## When to use this skill
Describe the situation in which an agent should follow this skill.

## Steps
1. First step, naming the exact \`reffy\` command to run.
2. Next step.

## Failure modes
- Describe a likely failure and how to recover from it.`;

export interface SkillCreateResult {
  name: string;
  entry_path: string;
  created: boolean;
}

/** Scaffold a new unmanaged skill from a template. */
export async function createSkill(repoRoot: string, name: string): Promise<SkillCreateResult> {
  if (!isKebabCase(name)) {
    throw new Error(`Skill name must be kebab-case: "${name}"`);
  }
  if (isManagedSkillName(name)) {
    throw new Error(`"${name}" is a managed skill name and is reserved by reffy init`);
  }

  const skillsDir = resolveSkillsDir(repoRoot);
  const dir = path.join(skillsDir, name);
  const entryPath = path.join(dir, SKILL_ENTRY_FILENAME);
  if (await pathExists(entryPath)) {
    throw new Error(`Skill "${name}" already exists at ${path.relative(repoRoot, entryPath)}`);
  }

  await fs.mkdir(dir, { recursive: true });
  const content = renderSkillFile({
    name,
    description: "One-line summary of what this skill does.",
    triggers: ["describe", "when", "to", "use"],
    commands: [],
    managed: false,
    body: UNMANAGED_TEMPLATE_BODY,
  });
  await fs.writeFile(entryPath, content, "utf8");
  return { name, entry_path: path.relative(repoRoot, entryPath), created: true };
}
