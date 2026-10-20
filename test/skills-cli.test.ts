import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTempRepo } from "./helpers.js";

const exec = promisify(execFile);
async function cli(repo: string, ...args: string[]) {
  try {
    return { code: 0, ...await exec(process.execPath, [path.resolve("dist/cli.js"), "skill", ...args, "--repo", repo]) };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

describe("standard skill CLI", () => {
  it("migrates legacy headers explicitly and reports compatibility warnings in both output modes", async () => {
    const { repoRoot } = await createTempRepo();
    const dir = path.join(repoRoot, ".reffy/skills/example"); await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, "SKILL.md");
    await fs.writeFile(file, '---\nname: example\ndescription: Use when taking notes.\ncommands: ["reffy doctor"]\nmanaged: false\n---\nbody\r\n');
    const compatible = await cli(repoRoot, "validate");
    expect(compatible.code).toBe(0); expect(compatible.stderr).toContain("deprecated");
    const strict = await cli(repoRoot, "validate", "--standard", "--output", "json");
    expect(strict.code).toBe(1); expect(JSON.parse(strict.stdout).mode).toBe("standard");
    const migrated = await cli(repoRoot, "migrate", "example", "--output", "json");
    expect(migrated.code).toBe(0); expect(JSON.parse(migrated.stdout).changed).toEqual(["example"]);
    expect((await cli(repoRoot, "validate", "--standard")).code).toBe(0);
    expect((await cli(repoRoot, "show", "example")).stdout).toBe("body\n");
    const json = JSON.parse((await cli(repoRoot, "show", "example", "--output", "json")).stdout);
    expect(json.skill).toMatchObject({ commands: ["reffy doctor"], location: file, path: ".reffy/skills/example/SKILL.md", metadata: { "reffy-managed": "false" }, body: "body\r\n" });
  });
  it("exports only on request, is idempotent, and protects edited destinations", async () => {
    const { repoRoot } = await createTempRepo();
    await exec(process.execPath, [path.resolve("dist/cli.js"), "init", "--repo", repoRoot]);
    await expect(fs.stat(path.join(repoRoot, ".agents"))).rejects.toThrow();
    const exported = await cli(repoRoot, "export", "--target", "agents", "--output", "json");
    expect(exported.code).toBe(0); expect(JSON.parse(exported.stdout).written).toHaveLength(7);
    const repeat = await cli(repoRoot, "export", "--target=agents", "--output=json");
    expect(JSON.parse(repeat.stdout).written).toEqual([]);
    const file = path.join(repoRoot, ".agents/skills/create-change/SKILL.md");
    await fs.appendFile(file, "User edit\n");
    const conflict = await cli(repoRoot, "export", "--target", "agents", "--output", "json");
    expect(conflict.code).toBe(1); expect(JSON.parse(conflict.stdout).error).toMatch(/edited/);
    expect((await cli(repoRoot, "export")).code).toBe(1);
    expect((await cli(repoRoot, "export", "--target", "unknown")).code).toBe(1);
  });
  it("lists metadata and locations without bodies, with errors for malformed siblings", async () => {
    const { repoRoot } = await createTempRepo();
    expect((await cli(repoRoot, "create", "example")).code).toBe(0);
    const bad = path.join(repoRoot, ".reffy/skills/bad"); await fs.mkdir(bad);
    await fs.writeFile(path.join(bad, "SKILL.md"), "not a header");
    const text = await cli(repoRoot, "list");
    expect(text.stdout).toContain(".reffy/skills/example/SKILL.md"); expect(text.stderr).toContain("bad");
    const json = JSON.parse((await cli(repoRoot, "list", "--output", "json")).stdout);
    expect(json.skills).toHaveLength(1); expect(json.skills[0].body).toBeUndefined();
    expect(path.isAbsolute(json.skills[0].location)).toBe(true);
    expect(json.diagnostics).toContainEqual(expect.objectContaining({ skill: "bad", severity: "error" }));
    const badShow = await cli(repoRoot, "show", "bad", "--output", "json");
    expect(badShow.code).toBe(1); expect(JSON.parse(badShow.stdout).diagnostics.length).toBeGreaterThan(0);
    expect((await cli(repoRoot, "migrate", "bad", "--output", "json")).code).toBe(1);
    expect((await cli(repoRoot, "migrate", "bad")).stderr).toContain("frontmatter");
  });
});
