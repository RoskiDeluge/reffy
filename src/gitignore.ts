import { promises as fs } from "node:fs";
import path from "node:path";

function normalizeLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function ensureGitignoreEntries(
  repoRoot: string,
  entries: string[],
): Promise<{ path: string; added: string[] }> {
  const gitignorePath = path.join(repoRoot, ".gitignore");
  const current = await fs.readFile(gitignorePath, "utf8").catch(() => "");
  const existing = new Set(normalizeLines(current));
  const added: string[] = [];

  for (const entry of entries) {
    const normalized = entry.trim();
    if (!normalized || existing.has(normalized)) continue;
    existing.add(normalized);
    added.push(normalized);
  }

  if (added.length === 0) {
    return { path: gitignorePath, added };
  }

  const nextLines = current.length > 0 ? current.replace(/\s*$/, "").split(/\r?\n/) : [];
  if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") {
    nextLines.push("");
  }
  nextLines.push(...added);

  await fs.writeFile(gitignorePath, `${nextLines.join("\n")}\n`, "utf8");
  return { path: gitignorePath, added };
}
