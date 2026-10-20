import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { atomicWrite, assertNoSymlinks } from "./skill-files.js";
import { discoverSkills, isSkillName, resolveSkillsDir, validateSkills } from "./skills.js";
import { resolveRefsDir } from "./refs-paths.js";

const TARGETS: Record<string, string> = { agents: ".agents/skills" };
interface FileState { hash: string; mode: number }
interface Snapshot { files: Record<string, FileState>; directories: string[] }
interface ExportState extends Snapshot { version: 1; target: "agents"; pending?: Snapshot }
const emptySnapshot = (): Snapshot => ({ files: {}, directories: [] });
const hash = (data: Buffer): string => createHash("sha256").update(data).digest("hex");
const same = (a: FileState | undefined, b: FileState | undefined): boolean => a?.hash === b?.hash && a?.mode === b?.mode;

async function statOrNull(filename: string) {
  return fs.lstat(filename).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
}
function safeRelative(value: string): boolean {
  return value.length > 0 && !value.includes("\\") && !value.includes("\0") && !path.posix.isAbsolute(value) &&
    value.split("/").every(p => p !== "" && p !== "." && p !== "..") && isSkillName(value.split("/")[0]);
}
function validateSnapshot(value: unknown): asserts value is Snapshot {
  if (!value || typeof value !== "object") throw new Error("Invalid export ownership snapshot");
  const s = value as Snapshot;
  if (!s.files || typeof s.files !== "object" || Array.isArray(s.files) || !Array.isArray(s.directories) ||
      s.directories.some(d => typeof d !== "string" || !safeRelative(d))) throw new Error("Invalid export ownership paths");
  const dirs = new Set(s.directories);
  for (const dir of dirs) {
    if (dir.includes("/") && !dirs.has(path.posix.dirname(dir))) throw new Error("Invalid export directory ancestry");
  }
  for (const [relative, file] of Object.entries(s.files)) {
    if (!safeRelative(relative) || !relative.includes("/") || !dirs.has(path.posix.dirname(relative)) || !file ||
      !/^[a-f0-9]{64}$/.test(file.hash) || !Number.isInteger(file.mode) || file.mode < 0 || file.mode > 0o777) {
      throw new Error("Invalid export ownership file record");
    }
  }
}
async function collectTree(root: string, prefix: string, result: Snapshot, contents?: Map<string, Buffer>): Promise<void> {
  const dir = path.join(root, prefix);
  const stat = await statOrNull(dir);
  if (!stat) return;
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Unsafe skill directory: ${dir}`);
  result.directories.push(prefix);
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const relative = `${prefix}/${entry.name}`;
    if (!safeRelative(relative)) throw new Error(`Unsafe skill resource: ${relative}`);
    if (entry.isDirectory()) await collectTree(root, relative, result, contents);
    else {
      const filename = path.join(root, relative);
      const stat = await fs.lstat(filename);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Unsafe skill resource: ${filename}`);
      const data = await fs.readFile(filename);
      result.files[relative] = { hash: hash(data), mode: stat.mode & 0o777 };
      contents?.set(relative, data);
    }
  }
}

/** Explicit export only. A durable pending snapshot permits recovery after partial I/O. */
export async function exportSkills(repoRoot: string, target: string): Promise<{ target: string; destination: string; written: string[]; removed: string[]; unchanged: string[] }> {
  const targetPath = Object.hasOwn(TARGETS, target) ? TARGETS[target] : undefined;
  if (!targetPath) throw new Error(`Unknown skill export target: ${target}; supported: agents`);
  repoRoot = path.resolve(repoRoot);
  await assertNoSymlinks(repoRoot, resolveSkillsDir(repoRoot));
  const validation = await validateSkills(repoRoot, undefined, { standard: true });
  if (!validation.ok) throw new Error(`Export requires standard-valid skills; run reffy skill migrate for legacy headers.\n${validation.issues.map(i => `${i.skill}: ${i.message}`).join("\n")}`);
  const destination = path.join(repoRoot, targetPath);
  const statePath = path.join(resolveRefsDir(repoRoot), "skill-exports.json");
  await assertNoSymlinks(repoRoot, destination);
  await assertNoSymlinks(repoRoot, statePath);
  let state: ExportState = { version: 1, target: "agents", ...emptySnapshot() };
  if (await statOrNull(statePath)) {
    state = JSON.parse(await fs.readFile(statePath, "utf8")) as ExportState;
    if (state.version !== 1 || state.target !== target) throw new Error("Unsupported export ownership state");
    validateSnapshot(state);
    if (state.pending) validateSnapshot(state.pending);
  }
  const desired = emptySnapshot();
  const contents = new Map<string, Buffer>();
  for (const skill of await discoverSkills(repoRoot)) {
    await collectTree(resolveSkillsDir(repoRoot), path.basename(skill.dir), desired, contents);
  }
  const ownedDirs = new Set([...state.directories, ...state.pending?.directories ?? []]);
  const roots = new Set([...ownedDirs, ...desired.directories].map(d => d.split("/")[0]));
  const current = emptySnapshot();
  // Inspect only our skill roots; unrelated native skills remain untouched.
  for (const root of roots) {
    const existing = await statOrNull(path.join(destination, root));
    if (existing && !ownedDirs.has(root)) throw new Error(`Untracked export destination: ${root}`);
    await collectTree(destination, root, current);
  }
  for (const dir of current.directories) {
    if (!ownedDirs.has(dir)) throw new Error(`Unexpected export directory: ${dir}`);
  }
  for (const [relative, file] of Object.entries(current.files)) {
    if (!same(file, state.files[relative]) && !same(file, state.pending?.files[relative])) {
      throw new Error(`Locally edited or untracked export file: ${relative}`);
    }
  }
  // Every semantic conflict is checked before writing the journal or destinations.
  const written = Object.keys(desired.files).filter(p => !same(current.files[p], desired.files[p]));
  const unchanged = Object.keys(desired.files).filter(p => same(current.files[p], desired.files[p]));
  const removed = Object.keys(current.files).filter(p => !Object.hasOwn(desired.files, p));
  if (!written.length && !removed.length && !state.pending &&
    Object.keys(state.files).length === Object.keys(desired.files).length &&
    Object.entries(desired.files).every(([p, file]) => same(file, state.files[p])) &&
    JSON.stringify([...state.directories].sort()) === JSON.stringify([...desired.directories].sort()) &&
    JSON.stringify([...current.directories].sort()) === JSON.stringify([...desired.directories].sort())) {
    return { target, destination, written, removed, unchanged };
  }
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await atomicWrite(statePath, JSON.stringify({ version: 1, target, ...current, pending: desired }, null, 2) + "\n");
  try {
    // Remove stale owned content first so file/directory shape changes can converge.
    for (const relative of removed) {
      const filename = path.join(destination, relative);
      await assertNoSymlinks(repoRoot, filename);
      await fs.unlink(filename).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
    }
    for (const dir of current.directories.filter(d => !desired.directories.includes(d)).sort((a, b) => b.length - a.length)) {
      await fs.rmdir(path.join(destination, dir)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
    }
    for (const dir of desired.directories) {
      await assertNoSymlinks(repoRoot, path.join(destination, dir));
      await fs.mkdir(path.join(destination, dir), { recursive: true });
    }
    for (const relative of written) {
      const filename = path.join(destination, relative);
      await assertNoSymlinks(repoRoot, filename);
      await atomicWrite(filename, contents.get(relative)!, desired.files[relative].mode);
    }
    await atomicWrite(statePath, JSON.stringify({ version: 1, target, ...desired }, null, 2) + "\n");
  } catch (error) {
    throw new Error(`Skill export interrupted; ownership journal retained. Retry export after resolving the I/O error: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { target, destination, written, removed, unchanged };
}
