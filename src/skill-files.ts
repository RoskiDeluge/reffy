import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/** Refuse symlinks at every existing component below a trusted repository root. */
export async function assertNoSymlinks(repoRoot: string, target: string): Promise<void> {
  const relative = path.relative(repoRoot, path.resolve(target));
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`Unsafe path: ${target}`);
  let current = repoRoot;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = await fs.lstat(current).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (stat?.isSymbolicLink()) throw new Error(`Symlink is not supported: ${current}`);
  }
}

export async function atomicWrite(filename: string, content: string | Buffer, mode?: number): Promise<void> {
  const temporary = path.join(path.dirname(filename), `.reffy-${randomUUID()}.tmp`);
  try {
    const existing = await fs.stat(filename).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    await fs.writeFile(temporary, content, { flag: "wx", mode: mode ?? existing?.mode });
    const preservedMode = mode ?? (existing ? existing.mode & 0o777 : undefined);
    if (preservedMode !== undefined) await fs.chmod(temporary, preservedMode);
    await fs.rename(temporary, filename);
  } finally {
    await fs.unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
  }
}
