import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { stringify } from "yaml";
import { createTempRepo } from "./helpers.js";
import { createSkill, discoverSkillsWithDiagnostics, migrateSkills, parseSkillFile, scaffoldManagedSkills, validateSkills, findCommandDrift, isKnownCommand } from "../src/skills.js";
import { exportSkills } from "../src/skill-export.js";

async function writeSkill(repo: string, name = "example", header: Record<string, unknown> = {}, body = "\n## Instructions\r\nKeep this body.\r\n") {
  const dir = path.join(repo, ".reffy/skills", name);
  await fs.mkdir(dir, { recursive: true });
  const filename = path.join(dir, "SKILL.md");
  await fs.writeFile(filename, `---\n${stringify({ name, description: "Use when capturing notes.", ...header })}---\n${body}`);
  return filename;
}

describe("standard skill headers", () => {
  it("accepts minimal and Unicode headers with no extensions", async () => {
    const { repoRoot } = await createTempRepo();
    for (const name of ["minimal", "données", "分析", "𐐨-数据"]) await writeSkill(repoRoot, name);
    expect(await validateSkills(repoRoot, undefined, { standard: true })).toMatchObject({ ok: true, warnings: [], skill_count: 4 });
  });
  it("preserves folded/literal YAML, optional fields and quoted commas", () => {
    const p = parseSkillFile('---\nname: example\ndescription: >-\n  Capture notes, ideas\n  and research.\nlicense: MIT\ncompatibility: Requires Reffy\nallowed-tools: Read Bash(reffy:*)\nmetadata:\n  author: "a,b"\n  reffy-triggers: \'["capture notes, ideas", "research"]\'\n---\n\r\nbody\r\n');
    expect(p.issues).toEqual([]);
    expect(p.frontmatter).toMatchObject({ description: "Capture notes, ideas and research.", license: "MIT", "allowed-tools": "Read Bash(reffy:*)", metadata: { author: "a,b" }, triggers: ["capture notes, ideas", "research"] });
    expect(p.body).toBe("\r\nbody\r\n");
    expect(parseSkillFile('---\nname: example\ndescription: |\n  line one\n  line two\n---\n').frontmatter.description).toBe("line one\nline two\n");
  });
  it.each([
    ["name", "x".repeat(65)], ["description", "d".repeat(1025)], ["compatibility", "c".repeat(501)],
    ["description", ""], ["description", 12], ["compatibility", ""], ["license", true], ["allowed-tools", ["Read"]],
    ["metadata", { version: 1 }], ["metadata", ["a"]], ["unknown", "value"],
    ["name", "Upper"], ["name", "a--b"], ["name", "-edge"], ["name", "edge-"],
    ["metadata", { "reffy-managed": "yes" }], ["metadata", { "reffy-commands": '[1]' }],
    ["metadata", { "reffy-triggers": "broken" }], ["commands", "reffy doctor"], ["managed", "true"],
  ])("rejects invalid %s = %j", async (key, value) => {
    const { repoRoot } = await createTempRepo();
    await writeSkill(repoRoot, "example", { [key]: value });
    expect((await validateSkills(repoRoot)).ok).toBe(false);
  });
  it("accepts exact limits including supplementary Unicode code points", () => {
    expect(parseSkillFile(`---\n${stringify({ name: "x".repeat(64), description: "𐐨".repeat(1024), compatibility: "c".repeat(500) })}---\n`).issues).toEqual([]);
  });
  it.each([
    'name: example\nname: second\ndescription: notes', 'name: example\ndescription: Use when: notes',
    '[one, two]', 'metadata:\n  1: "value"', 'name: example\ndescription: !unknown value',
  ])("reports malformed YAML: %s", header => {
    expect(parseSkillFile(`---\n${header}\n---\nbody`).issues.length).toBeGreaterThan(0);
  });
  it("keeps valid siblings discoverable with structured diagnostics", async () => {
    const { repoRoot } = await createTempRepo();
    await writeSkill(repoRoot, "valid");
    await writeSkill(repoRoot, "invalid", { description: false });
    const result = await discoverSkillsWithDiagnostics(repoRoot);
    expect(result.skills.map(s => s.name)).toEqual(["valid"]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ skill: "invalid", field: "description", severity: "error" }));
  });
  it("flags directory mismatch and duplicate normalized names", async () => {
    const { repoRoot } = await createTempRepo();
    await writeSkill(repoRoot, "one", { name: "same" }); await writeSkill(repoRoot, "two", { name: "same" });
    const { issues } = await validateSkills(repoRoot);
    expect(issues.map(i => i.message).join(" ")).toMatch(/does not match/);
    expect(issues.map(i => i.message).join(" ")).toMatch(/duplicate/);
  });
});

describe("legacy compatibility and migration", () => {
  it("warns in compatibility mode, fails strict, and preserves body, mode, metadata and resources", async () => {
    const { repoRoot } = await createTempRepo();
    const file = await writeSkill(repoRoot, "example", { triggers: [], commands: ["reffy frobnicate"], managed: false, license: "MIT", metadata: { author: "someone" } });
    await fs.chmod(file, 0o755);
    const before = parseSkillFile(await fs.readFile(file, "utf8")).body;
    await fs.writeFile(path.join(path.dirname(file), "reference.txt"), "reference");
    expect(await validateSkills(repoRoot)).toMatchObject({ ok: true, warnings: expect.any(Array) });
    expect((await validateSkills(repoRoot, undefined, { standard: true })).ok).toBe(false);
    expect(await findCommandDrift(repoRoot)).toEqual([{ skill: "example", command: "reffy frobnicate" }]);
    expect(await migrateSkills(repoRoot)).toEqual({ changed: ["example"], skipped: [] });
    const parsed = parseSkillFile(await fs.readFile(file, "utf8"));
    expect(parsed.body).toBe(before);
    expect(parsed.frontmatter.metadata).toMatchObject({ author: "someone", "reffy-managed": "false", "reffy-triggers": "[]" });
    expect((await fs.stat(file)).mode & 0o777).toBe(0o755);
    expect(await fs.readFile(path.join(path.dirname(file), "reference.txt"), "utf8")).toBe("reference");
    expect((await validateSkills(repoRoot, undefined, { standard: true })).ok).toBe(true);
    expect(await migrateSkills(repoRoot)).toEqual({ changed: [], skipped: ["example"] });
    expect(await findCommandDrift(repoRoot)).toEqual([{ skill: "example", command: "reffy frobnicate" }]);
  });
  it("preflights the entire migration batch before rewriting valid siblings", async () => {
    const { repoRoot } = await createTempRepo();
    const file = await writeSkill(repoRoot, "a-valid", { managed: false });
    const before = await fs.readFile(file, "utf8");
    await writeSkill(repoRoot, "z-conflict", { managed: false, metadata: { "reffy-managed": "true" } });
    await expect(migrateSkills(repoRoot)).rejects.toThrow(/Conflicting/);
    expect(await fs.readFile(file, "utf8")).toBe(before);
    await expect(migrateSkills(repoRoot, "missing")).rejects.toThrow(/not found/);
  });
  it("accepts matching legacy and metadata values and refuses unknown fields", async () => {
    const { repoRoot } = await createTempRepo();
    await writeSkill(repoRoot, "example", { managed: false, metadata: { "reffy-managed": "false" } });
    expect((await validateSkills(repoRoot)).ok).toBe(true);
    await migrateSkills(repoRoot);
    await writeSkill(repoRoot, "bad", { unknown: "keep this" });
    await expect(migrateSkills(repoRoot)).rejects.toThrow(/Unknown/);
  });
  it("generates portable built-ins/custom skills and protects unmanaged collisions", async () => {
    const { repoRoot } = await createTempRepo();
    await scaffoldManagedSkills(repoRoot); await createSkill(repoRoot, "custom");
    expect((await validateSkills(repoRoot, undefined, { standard: true })).ok).toBe(true);
    await writeSkill(repoRoot, "diagnose");
    await expect(scaffoldManagedSkills(repoRoot)).rejects.toThrow(/ownership conflict/);
    expect(parseSkillFile(await fs.readFile(path.join(repoRoot, ".reffy/skills/diagnose/SKILL.md"), "utf8")).frontmatter.managed).toBe(false);
  });
});

describe("native skill export", () => {
  it("supports resource shape changes and preserves unrelated native skills", async () => {
    const { repoRoot } = await createTempRepo();
    const source = await writeSkill(repoRoot);
    const resource = path.join(path.dirname(source), "resource");
    await fs.writeFile(resource, "one file");
    const { destination } = await exportSkills(repoRoot, "agents");
    await fs.mkdir(path.join(destination, "other-skill"));
    await fs.writeFile(path.join(destination, "other-skill/SKILL.md"), "User owned");
    await fs.unlink(resource); await fs.mkdir(resource); await fs.writeFile(path.join(resource, "nested.txt"), "nested");
    await exportSkills(repoRoot, "agents");
    expect(await fs.readFile(path.join(destination, "example/resource/nested.txt"), "utf8")).toBe("nested");
    await fs.unlink(path.join(resource, "nested.txt")); await fs.rmdir(resource); await fs.writeFile(resource, "a file again");
    await exportSkills(repoRoot, "agents");
    expect(await fs.readFile(path.join(destination, "example/resource"), "utf8")).toBe("a file again");
    expect(await fs.readFile(path.join(destination, "other-skill/SKILL.md"), "utf8")).toBe("User owned");
  });
  it("copies resources/modes, refreshes, removes stale content, and recreates missing files", async () => {
    const { repoRoot } = await createTempRepo();
    const source = await writeSkill(repoRoot);
    const script = path.join(path.dirname(source), "scripts/run.sh");
    await fs.mkdir(path.dirname(script)); await fs.writeFile(script, "#!/bin/sh\ntrue\n"); await fs.chmod(script, 0o755);
    const first = await exportSkills(repoRoot, "agents");
    const dest = path.join(first.destination, "example");
    expect(await fs.readFile(path.join(dest, "scripts/run.sh"), "utf8")).toBe("#!/bin/sh\ntrue\n");
    expect((await fs.stat(path.join(dest, "scripts/run.sh"))).mode & 0o777).toBe(0o755);
    expect((await exportSkills(repoRoot, "agents")).written).toEqual([]);
    await fs.unlink(path.join(dest, "SKILL.md"));
    expect((await exportSkills(repoRoot, "agents")).written).toContain("example/SKILL.md");
    await writeSkill(repoRoot, "example", { description: "Updated description" });
    expect((await exportSkills(repoRoot, "agents")).written).toContain("example/SKILL.md");
    await fs.unlink(script);
    await fs.rmdir(path.dirname(script));
    expect((await exportSkills(repoRoot, "agents")).removed).toContain("example/scripts/run.sh");
    await expect(fs.stat(path.join(dest, "scripts"))).rejects.toThrow();
    await fs.rm(path.dirname(source), { recursive: true });
    await exportSkills(repoRoot, "agents");
    await expect(fs.stat(dest)).rejects.toThrow();
  });
  it.each(["edit", "extra-file", "extra-directory", "untracked", "symlink"])("preflights %s conflicts without writing other destinations", async kind => {
    const { repoRoot } = await createTempRepo();
    await writeSkill(repoRoot, "a"); const source = await writeSkill(repoRoot, "z");
    const { destination } = await exportSkills(repoRoot, "agents");
    const before = await fs.readFile(path.join(destination, "a/SKILL.md"), "utf8");
    await writeSkill(repoRoot, "a", { description: "Changed" });
    if (kind === "edit") await fs.appendFile(path.join(destination, "z/SKILL.md"), "changed");
    if (kind === "extra-file") await fs.writeFile(path.join(destination, "z/extra.txt"), "user");
    if (kind === "extra-directory") await fs.mkdir(path.join(destination, "z/extra"));
    if (kind === "untracked") { await writeSkill(repoRoot, "new"); await fs.mkdir(path.join(destination, "new")); }
    if (kind === "symlink") await fs.symlink(source, path.join(destination, "z/link"));
    await expect(exportSkills(repoRoot, "agents")).rejects.toThrow(/edited|Untracked|Unexpected|Unsafe/);
    expect(await fs.readFile(path.join(destination, "a/SKILL.md"), "utf8")).toBe(before);
  });
  it("rejects source/ancestor symlinks, unsafe state, legacy headers and unknown targets", async () => {
    const { repoRoot } = await createTempRepo();
    const source = await writeSkill(repoRoot);
    await expect(exportSkills(repoRoot, "unknown")).rejects.toThrow(/Unknown/);
    await writeSkill(repoRoot, "legacy", { triggers: ["x"] });
    await expect(exportSkills(repoRoot, "agents")).rejects.toThrow(/migrate/);
    await fs.rm(path.join(repoRoot, ".reffy/skills/legacy"), { recursive: true });
    await fs.symlink(source, path.join(path.dirname(source), "link"));
    await expect(exportSkills(repoRoot, "agents")).rejects.toThrow(/Unsafe/);
    await fs.unlink(path.join(path.dirname(source), "link"));
    const state = path.join(repoRoot, ".reffy/skill-exports.json");
    await fs.writeFile(state, JSON.stringify({ version: 1, target: "agents", files: {}, directories: ["../outside"] }));
    await expect(exportSkills(repoRoot, "agents")).rejects.toThrow(/Invalid/);
    await fs.unlink(state);
    const outside = path.join(repoRoot, "outside"); await fs.mkdir(outside);
    await fs.symlink(outside, path.join(repoRoot, ".agents"));
    await expect(exportSkills(repoRoot, "agents")).rejects.toThrow(/Symlink/);
  });
  it("recovers a directory-to-file replacement when the final state write fails", async () => {
    const { repoRoot } = await createTempRepo();
    const source = await writeSkill(repoRoot);
    const resource = path.join(path.dirname(source), "resource");
    await fs.mkdir(resource); await fs.writeFile(path.join(resource, "nested"), "before");
    await exportSkills(repoRoot, "agents");
    await fs.unlink(path.join(resource, "nested")); await fs.rmdir(resource); await fs.writeFile(resource, "after");
    const rename = fs.rename.bind(fs); let journals = 0;
    const spy = vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
      if (String(to).endsWith("skill-exports.json") && ++journals === 2) throw new Error("state write failed");
      return rename(from, to);
    });
    try { await expect(exportSkills(repoRoot, "agents")).rejects.toThrow(/journal retained/); } finally { spy.mockRestore(); }
    expect((await exportSkills(repoRoot, "agents")).written).toEqual([]);
    expect(await fs.readFile(path.join(repoRoot, ".agents/skills/example/resource"), "utf8")).toBe("after");
  });
  it("recovers after partial I/O and permits a changed source on retry", async () => {
    const { repoRoot } = await createTempRepo();
    await writeSkill(repoRoot, "a"); await writeSkill(repoRoot, "b");
    const rename = fs.rename.bind(fs); let written = 0;
    const spy = vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
      if (String(to).includes(`${path.sep}.agents${path.sep}`) && ++written === 2) throw new Error("simulated disk error");
      return rename(from, to);
    });
    try { await expect(exportSkills(repoRoot, "agents")).rejects.toThrow(/journal retained/); } finally { spy.mockRestore(); }
    await writeSkill(repoRoot, "a", { description: "Changed during recovery" });
    const result = await exportSkills(repoRoot, "agents");
    expect(result.written).toHaveLength(2);
    expect(JSON.parse(await fs.readFile(path.join(repoRoot, ".reffy/skill-exports.json"), "utf8")).pending).toBeUndefined();
    expect((await exportSkills(repoRoot, "agents")).written).toEqual([]);
  });
});


describe("command flags in both header formats", () => {
  it("recognizes current options and detects stale options without interpreting quoted data", async () => {
    expect(isKnownCommand('reffy plan create --change-id x --title "--not-a-flag"')).toBe(true);
    expect(isKnownCommand("reffy skill validate --standard --stale-flag")).toBe(false);
    expect(isKnownCommand("reffy skill validate -z")).toBe(false);
    expect(isKnownCommand("reffy skill export --target=agents")).toBe(true);
    const { repoRoot } = await createTempRepo();
    await writeSkill(repoRoot, "legacy", { commands: ["reffy doctor --stale-flag"] });
    await writeSkill(repoRoot, "standard", { metadata: { "reffy-commands": '["reffy doctor --stale-flag"]' } });
    expect((await findCommandDrift(repoRoot)).map(d => d.skill)).toEqual(["legacy", "standard"]);
  });
});
