import { promises as fs } from "node:fs";
import path from "node:path";
import { parseDocument, stringify } from "yaml";

import { resolveRefsDir } from "./refs-paths.js";
import { atomicWrite, assertNoSymlinks } from "./skill-files.js";

export const SKILLS_DIRNAME = "skills";
export const SKILL_ENTRY_FILENAME = "SKILL.md";

export interface StandardSkillHeader {
  name?: string;
  description?: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  "allowed-tools"?: string;
}
export interface SkillFrontmatter extends StandardSkillHeader {
  triggers: string[];
  commands: string[];
  managed: boolean;
}
export interface SkillDescriptor extends SkillFrontmatter {
  name: string;
  description: string;
  path: string;
  location: string;
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
  warnings: SkillValidationIssue[];
  skill_count: number;
}
export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  header: Record<string, unknown>;
  body: string;
  issues: Omit<SkillValidationIssue, "skill">[];
  warnings: Omit<SkillValidationIssue, "skill">[];
}
const STANDARD_FIELDS = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
const LEGACY_FIELDS = ["triggers", "commands", "managed"] as const;
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function resolveSkillsDir(repoRoot: string): string {
  return path.join(resolveRefsDir(repoRoot), SKILLS_DIRNAME);
}
export function isKebabCase(value: string): boolean {
  return KEBAB_CASE.test(value);
}
export function isSkillName(value: string): boolean {
  const normalized = value.normalize("NFKC");
  return Array.from(normalized).length <= 64 && normalized === normalized.toLowerCase() &&
    /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(normalized);
}
async function pathExists(targetPath: string): Promise<boolean> {
  try { await fs.access(targetPath); return true; } catch { return false; }
}
function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse real YAML, preserving the body verbatim, with diagnostics instead of silent coercion. */
export function parseSkillFile(content: string, options: { standard?: boolean } = {}): ParsedSkill {
  const frontmatter: SkillFrontmatter = { triggers: [], commands: [], managed: false };
  const result: ParsedSkill = { frontmatter, header: {}, body: content, issues: [], warnings: [] };
  const issue = (field: string, message: string) => result.issues.push({ field, message });
  const match = /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m.exec(content);
  if (!match || match.index !== 0) {
    issue("frontmatter", "SKILL.md must begin with a closed YAML frontmatter block");
    return result;
  }
  result.body = content.slice(match[0].length);
  try {
    const doc = parseDocument(match[1], { uniqueKeys: true, stringKeys: true });
    if (doc.errors.length || doc.warnings.length) throw new Error([...doc.errors, ...doc.warnings].map(e => e.message).join("; "));
    const header: unknown = doc.toJS({ maxAliasCount: 50 });
    if (!isMapping(header)) throw new Error("frontmatter must be a YAML mapping");
    result.header = header;
  } catch (error) {
    issue("frontmatter", `Invalid YAML: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
  const header = result.header;
  for (const key of Object.keys(header)) {
    if (STANDARD_FIELDS.has(key)) continue;
    if (LEGACY_FIELDS.includes(key as typeof LEGACY_FIELDS[number])) {
      if (options.standard) issue(key, `Nonstandard legacy field: ${key}; run reffy skill migrate`);
      result.warnings.push({ field: key, message: `Legacy field ${key} is deprecated; run reffy skill migrate` });
    } else issue(key, `Unknown frontmatter field: ${key}`);
  }
  for (const key of ["name", "description", "license", "compatibility", "allowed-tools"] as const) {
    const value = header[key];
    if (value === undefined && key !== "name" && key !== "description") continue;
    if (typeof value !== "string") { issue(key, `${key} must be a string`); continue; }
    frontmatter[key] = value;
    if (["name", "description", "compatibility"].includes(key)) {
      const max = key === "name" ? 64 : key === "description" ? 1024 : 500;
      if (!value.trim() || Array.from(value).length > max) issue(key, `${key} must contain 1–${max} characters`);
    }
  }
  if (frontmatter.name && !isSkillName(frontmatter.name)) issue("name", "name must use lowercase alphanumeric characters and single internal hyphens (maximum 64 characters)");
  if (header.metadata !== undefined) {
    if (!isMapping(header.metadata) || Object.values(header.metadata).some(v => typeof v !== "string")) {
      issue("metadata", "metadata must map string keys to string values");
    } else frontmatter.metadata = header.metadata as Record<string, string>;
  }
  for (const key of LEGACY_FIELDS) {
    const legacy = header[key];
    const encoded = frontmatter.metadata?.[`reffy-${key}`];
    let value: unknown;
    if (encoded !== undefined) {
      try {
        value = JSON.parse(encoded);
        if (key === "managed" && encoded !== "true" && encoded !== "false") throw new Error();
      } catch { issue(`metadata.reffy-${key}`, `reffy-${key} must encode ${key === "managed" ? "true or false" : "a JSON array of strings"}`); }
    }
    for (const [field, candidate] of [[key, legacy], [`metadata.reffy-${key}`, value]] as const) {
      if (candidate === undefined) continue;
      if (key === "managed" ? typeof candidate !== "boolean" : !Array.isArray(candidate) || candidate.some(v => typeof v !== "string")) {
        issue(field, `${field} must be ${key === "managed" ? "a boolean" : "an array of strings"}`);
      }
    }
    if (legacy !== undefined && value !== undefined && JSON.stringify(legacy) !== JSON.stringify(value)) issue(key, `Conflicting legacy and metadata declarations for ${key}`);
    const chosen = value ?? legacy;
    if (key === "managed") { if (typeof chosen === "boolean") frontmatter.managed = chosen; }
    else if (Array.isArray(chosen) && chosen.every(v => typeof v === "string")) frontmatter[key] = chosen;
  }
  return result;
}

async function skillDirectories(repoRoot: string): Promise<string[]> {
  const entries = await fs.readdir(resolveSkillsDir(repoRoot), { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  return entries.filter(e => e.isDirectory() || e.isSymbolicLink()).map(e => e.name).sort();
}
async function readSkill(repoRoot: string, dirName: string, standard = false): Promise<ParsedSkill> {
  const entryPath = path.join(resolveSkillsDir(repoRoot), dirName, SKILL_ENTRY_FILENAME);
  try {
    await assertNoSymlinks(path.resolve(repoRoot), entryPath);
    const parsed = parseSkillFile(await fs.readFile(entryPath, "utf8"), { standard });
    if (parsed.frontmatter.name && parsed.frontmatter.name.normalize("NFKC") !== dirName.normalize("NFKC")) {
      parsed.issues.push({ field: "name", message: `name "${parsed.frontmatter.name}" does not match directory name "${dirName}"` });
    }
    return parsed;
  } catch (error) {
    return { frontmatter: { triggers: [], commands: [], managed: false }, header: {}, body: "", warnings: [],
      issues: [{ field: "path", message: `${SKILL_ENTRY_FILENAME}: ${error instanceof Error ? error.message : String(error)}` }] };
  }
}
export function skillDescriptor({ dir: _dir, entryPath: _entryPath, body: _body, ...descriptor }: SkillRecord): SkillDescriptor {
  return descriptor;
}
export async function discoverSkillsWithDiagnostics(repoRoot: string): Promise<{ skills: SkillRecord[]; diagnostics: (SkillValidationIssue & { severity: "error" | "warning" })[] }> {
  const skills: SkillRecord[] = [];
  const diagnostics: (SkillValidationIssue & { severity: "error" | "warning" })[] = [];
  for (const dirName of await skillDirectories(repoRoot)) {
    const parsed = await readSkill(repoRoot, dirName);
    for (const i of parsed.issues) diagnostics.push({ skill: dirName, ...i, severity: "error" });
    for (const i of parsed.warnings) diagnostics.push({ skill: dirName, ...i, severity: "warning" });
    if (parsed.issues.length) continue;
    const dir = path.join(resolveSkillsDir(repoRoot), dirName);
    const entryPath = path.join(dir, SKILL_ENTRY_FILENAME);
    skills.push({ ...parsed.frontmatter, name: parsed.frontmatter.name!, description: parsed.frontmatter.description!,
      path: path.relative(repoRoot, entryPath), location: path.resolve(entryPath), dir, entryPath, body: parsed.body });
  }
  return { skills, diagnostics };
}
export async function discoverSkills(repoRoot: string): Promise<SkillRecord[]> {
  return (await discoverSkillsWithDiagnostics(repoRoot)).skills;
}
export async function findSkill(repoRoot: string, name: string): Promise<SkillRecord | null> {
  return (await discoverSkills(repoRoot)).find(skill => skill.name === name) ?? null;
}
export async function validateSkills(repoRoot: string, name?: string, options: { standard?: boolean } = {}): Promise<SkillValidationResult> {
  const dirs = (await skillDirectories(repoRoot)).filter(d => name === undefined || name === d);
  const issues: SkillValidationIssue[] = [];
  const warnings: SkillValidationIssue[] = [];
  const seen = new Set<string>();
  for (const dirName of dirs) {
    const parsed = await readSkill(repoRoot, dirName, options.standard);
    issues.push(...parsed.issues.map(i => ({ skill: dirName, ...i })));
    warnings.push(...parsed.warnings.map(i => ({ skill: dirName, ...i })));
    const normalized = parsed.frontmatter.name?.normalize("NFKC");
    if (normalized && seen.has(normalized)) issues.push({ skill: dirName, field: "name", message: `duplicate skill name "${normalized}"` });
    if (normalized) seen.add(normalized);
  }
  if (name !== undefined && !dirs.length) issues.push({ skill: name, message: `skill "${name}" was not found` });
  return { ok: !issues.length, issues, warnings, skill_count: dirs.length };
}
export async function migrateSkills(repoRoot: string, name?: string): Promise<{ changed: string[]; skipped: string[] }> {
  const validation = await validateSkills(repoRoot, name);
  if (!validation.ok) throw new Error(validation.issues.map(i => `${i.skill} (${i.field ?? "header"}): ${i.message}`).join("\n"));
  const writes: { name: string; entryPath: string; content: string }[] = [];
  const skipped: string[] = [];
  for (const dirName of (await skillDirectories(repoRoot)).filter(d => name === undefined || name === d)) {
    const parsed = await readSkill(repoRoot, dirName);
    const header = { ...parsed.header };
    const metadata = { ...parsed.frontmatter.metadata };
    let changed = false;
    for (const key of LEGACY_FIELDS) {
      if (header[key] !== undefined) {
        metadata[`reffy-${key}`] = JSON.stringify(parsed.frontmatter[key]);
        delete header[key];
        changed = true;
      }
    }
    if (!changed) { skipped.push(dirName); continue; }
    header.metadata = metadata;
    writes.push({ name: dirName, entryPath: path.join(resolveSkillsDir(repoRoot), dirName, SKILL_ENTRY_FILENAME),
      content: `---\n${stringify(header)}---\n${parsed.body}` });
  }
  for (const write of writes) await atomicWrite(write.entryPath, write.content);
  return { changed: writes.map(w => w.name), skipped };
}

// --- Command-reference staleness -------------------------------------------

/**
 * The canonical command table of the installed CLI. `reffy doctor` cross-checks
 * each skill's declared `commands` against this table and warns on drift.
 */
export const KNOWN_COMMANDS: readonly string[] = [
  "reffy init",
  "reffy bootstrap",
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
  "reffy skill migrate",
  "reffy skill export",
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

const COMMAND_FLAGS: Record<string, readonly string[]> = {
  "reffy plan create": ["--change-id", "--title", "--artifacts", "--all", "--force"],
  "reffy skill validate": ["--standard"],
  "reffy skill export": ["--target"],
  "reffy remote init": ["--workspace-id", "--endpoint", "--manager-pod", "--manager-actor", "--provision", "--create", "--resolve", "--label", "--env-file"],
  "reffy remote status": ["--workspace-id", "--project-id", "--env-file"],
  "reffy remote push": ["--workspace-id", "--env-file"],
  "reffy remote ls": ["--workspace-id", "--project-id", "--prefix", "--env-file"],
  "reffy remote cat": ["--workspace-id", "--project-id", "--env-file"],
  "reffy remote snapshot": ["--workspace-id", "--project-id", "--env-file"],
  "reffy remote workspace create": ["--label", "--env-file"],
  "reffy remote workspace get": ["--env-file"],
  "reffy remote workspace delete": ["--yes", "--env-file"],
  "reffy remote project register": ["--workspace-id", "--project-id", "--env-file"],
  "reffy remote project list": ["--workspace-id", "--env-file"],
  "reffy diagram render": ["--input", "--stdin", "--format", "--theme", "--bg", "--fg", "--line", "--accent", "--muted", "--surface", "--border", "--font"],
};
export function isKnownCommand(command: string): boolean {
  const head = commandHead(command);
  const known = [...KNOWN_COMMANDS].sort((a, b) => b.length - a.length).find(c => head === c || head.startsWith(`${c} `));
  if (!known) return false;
  const allowed = new Set(["--repo", "--output", "--json", ...COMMAND_FLAGS[known] ?? []]);
  // Flags inside quoted argument values are data, not CLI options.
  const unquoted = command.replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, "ARG");
  return [...unquoted.matchAll(/(?:^|\s)(--?[a-zA-Z0-9][a-zA-Z0-9-]*)(?==|\s|$)/g)].every(m => allowed.has(m[1]));
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
  const header = {
    name: def.name,
    description: def.description,
    compatibility: "Requires the Reffy CLI and an initialized Reffy workspace.",
    metadata: {
      "reffy-managed": String(def.managed),
      "reffy-commands": JSON.stringify(def.commands),
      "reffy-triggers": JSON.stringify(def.triggers),
    },
  };
  return `---\n${stringify(header, { lineWidth: 0 })}---\n\n${def.body.trim()}\n`;
}

export const MANAGED_SKILLS: readonly ManagedSkillDefinition[] = [
  {
    name: "create-artifact",
    description: "Capture ideas, research, and exploratory notes as Reffy artifacts. Use when asked to record an idea, add a note, preserve research context, or reindex artifacts before formal planning.",
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
    description: "Create a ReffySpec proposal from ideation artifacts. Use when asked to plan a new change, write a proposal, or turn captured research into implementation tasks and spec deltas.",
    triggers: ["new change", "plan create", "turn artifact into proposal"],
    commands: ["reffy plan create", "reffy plan validate"],
    body: `## When to use this skill
Use this when ideation has converged and you are ready to scaffold a formal ReffySpec change from one or more artifacts.

## Steps
1. Pick the source artifacts in \`.reffy/artifacts/\` that inform the change.
2. Run \`reffy plan create --change-id <kebab-id> --artifacts <files> --title "<title>"\`.
3. Fill in the scaffolded \`proposal.md\`, \`design.md\`, \`tasks.md\`, and \`specs/<capability>/spec.md\` deltas.
   Each delta requirement needs at least one \`#### Scenario:\`.
   This tree is exhaustive: put durable decisions in \`design.md\`, checklist work in \`tasks.md\`, and exploratory context in indexed \`.reffy/artifacts/\` instead of adding change-local files.
4. For renames, use paired \`FROM: ### Requirement: Old Name\` and \`TO: ### Requirement: New Name\` lines under \`## RENAMED Requirements\`; rename pairs do not need scenarios.
5. Run \`reffy plan validate <change-id>\` and resolve every error before implementing.

## Failure modes
- If validation reports a missing scenario block, add at least one scenario to each requirement.
- Use a unique verb-led, kebab-case \`change-id\`.`,
  },
  {
    name: "archive-change",
    description: "Archive an implemented and verified ReffySpec change and merge its delta into canonical specs. Use when asked to archive a change, finish shipped work, or merge a completed spec delta.",
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
- If validation reports an unexpected change path, consolidate durable content into \`design.md\` or \`tasks.md\`, or move exploratory content to indexed \`.reffy/artifacts/\`.
- If archive reports unmerged or conflicting requirements, inspect the delta against the canonical spec before retrying.
- Rename-only entries require paired \`FROM: ### Requirement: Old Name\` and \`TO: ### Requirement: New Name\` lines; modifications after a rename use the destination name.`,
  },
  {
    name: "supersede-change",
    description: "Create a change that supersedes a prior decision. Use for a pivot, deprecation, wind-down, reversal, abandoning an approach, or requests to change direction, deprecate, wind down, or replace prior behavior.",
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
    description: "Inspect canonical ReffySpec requirements and scenarios. Use when asked what current specs say, to list or show specs, or to ground a proposal or implementation in current behavior.",
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
    description: "Link, inspect, and publish a Reffy remote workspace backed by Paseo. Use for remote sync, remote status, remote workspace inspection, shared references, or requests to push a workspace, publish references, or synchronize shared context.",
    triggers: [
      "remote sync",
      "remote workspace",
      "push workspace",
      "publish workspace",
      "paseo",
      "remote status",
      "shared references",
      "publish references",
    ],
    commands: ["reffy remote init", "reffy remote status", "reffy remote push", "reffy remote snapshot"],
    body: `## When to use this skill
Use this to link, publish, or inspect the shared remote workspace projection.

## Required environment
- \`PASEO_ENDPOINT\` — the Paseo endpoint URL (never persisted).
- \`PASEO_TOKEN\` — the bearer token (never persisted by the CLI).
- \`PASEO_PROVISIONING_TOKEN\` — the deployment provisioning credential, needed
  only for \`reffy remote init --provision\` when it creates a manager actor. Held
  by the Paseo operator; never persisted by the CLI and never a substitute for
  \`PASEO_TOKEN\`.

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
    description: "Diagnose Reffy workspace health. Use when asked to run doctor, troubleshoot initialization, investigate validation failures, or repair stale command references and workspace setup.",
    triggers: ["diagnose", "doctor", "validate", "workspace health"],
    commands: ["reffy doctor", "reffy validate"],
    body: `## When to use this skill
Use this first when a Reffy command misbehaves in an unfamiliar repo.

## Steps
1. Run \`reffy doctor\` for the required/optional check list.
2. Run \`reffy validate\` to confirm the manifest contract.
3. Resolve each failure by class:
   - Missing \`.reffy/\` or \`AGENTS.md\`: run \`reffy init\`.
   - Legacy \`.references/\` workspace: run \`reffy init\`.
   - Invalid manifest: fix the reported entry, then re-run \`reffy validate\`.
   - Skill command drift: update the stale skill's \`metadata.reffy-commands\` JSON array string.

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

  for (const def of MANAGED_SKILLS) {
    const entryPath = path.join(skillsDir, def.name, SKILL_ENTRY_FILENAME);
    await assertNoSymlinks(path.resolve(repoRoot), entryPath);
    if (await pathExists(entryPath)) {
      const parsed = await readSkill(repoRoot, def.name);
      if (parsed.issues.length || !parsed.frontmatter.managed) {
        throw new Error(`Skill ownership conflict at ${entryPath}; move or migrate the user-owned file before re-running init`);
      }
    }
  }
  const written: string[] = [];
  for (const def of MANAGED_SKILLS) {
    const dir = path.join(skillsDir, def.name);
    await fs.mkdir(dir, { recursive: true });
    const entryPath = path.join(dir, SKILL_ENTRY_FILENAME);
    const content = renderSkillFile({ ...def, managed: true });
    await atomicWrite(entryPath, content);
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
  if (!isSkillName(name)) {
    throw new Error(`Skill name must be lowercase kebab-case with at most 64 characters: "${name}"`);
  }
  if (isManagedSkillName(name)) {
    throw new Error(`"${name}" is a managed skill name and is reserved by reffy init`);
  }

  const skillsDir = resolveSkillsDir(repoRoot);
  const dir = path.join(skillsDir, name);
  await assertNoSymlinks(path.resolve(repoRoot), dir);
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
