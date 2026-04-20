import { promises as fs } from "node:fs";
import path from "node:path";

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseDotEnv(content: string): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const normalized = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = normalized.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    const rawValue = normalized.slice(equalsIndex + 1).trim();
    parsed[key] = stripQuotes(rawValue);
  }

  return parsed;
}

export async function loadDotEnvIfPresent(
  repoRoot: string,
  envFile = ".env",
): Promise<{ loaded: boolean; path: string }> {
  const envPath = path.isAbsolute(envFile) ? envFile : path.join(repoRoot, envFile);
  const text = await fs.readFile(envPath, "utf8").catch(() => null);
  if (text === null) {
    return { loaded: false, path: envPath };
  }

  const parsed = parseDotEnv(text);
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return { loaded: true, path: envPath };
}
