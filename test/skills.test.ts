import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createSkill,
  discoverSkills,
  findCommandDrift,
  isKnownCommand,
  parseSkillFile,
  scaffoldManagedSkills,
  validateSkills,
  MANAGED_SKILLS,
} from "../src/skills.js";
import { createTempRepo } from "./helpers.js";

async function writeSkill(repoRoot: string, name: string, content: string): Promise<void> {
  const dir = path.join(repoRoot, ".reffy", "skills", name);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "SKILL.md"), content, "utf8");
}

describe("parseSkillFile", () => {
  it("parses inline-list frontmatter and body", () => {
    const { frontmatter, body } = parseSkillFile(
      ['---', 'name: foo', 'description: A foo skill.', 'triggers: ["a", "b"]', 'commands: ["reffy doctor"]', 'managed: true', '---', '', '## Body', 'text'].join("\n"),
    );
    expect(frontmatter.name).toBe("foo");
    expect(frontmatter.description).toBe("A foo skill.");
    expect(frontmatter.triggers).toEqual(["a", "b"]);
    expect(frontmatter.commands).toEqual(["reffy doctor"]);
    expect(frontmatter.managed).toBe(true);
    expect(body).toContain("## Body");
  });

  it("parses block-list frontmatter", () => {
    const { frontmatter } = parseSkillFile(
      ['---', 'name: bar', 'triggers:', '  - one', '  - two', '---', 'body'].join("\n"),
    );
    expect(frontmatter.triggers).toEqual(["one", "two"]);
    expect(frontmatter.managed).toBe(false);
  });

  it("treats files without frontmatter as all body", () => {
    const { frontmatter, body } = parseSkillFile("just a body\n");
    expect(frontmatter.name).toBeUndefined();
    expect(body).toBe("just a body\n");
  });
});

describe("scaffoldManagedSkills", () => {
  it("writes all managed skills and reports an empty unmanaged set", async () => {
    const repo = await createTempRepo();
    const result = await scaffoldManagedSkills(repo.repoRoot);
    expect(result.created_dir).toBe(true);
    expect(result.written_skills.sort()).toEqual(MANAGED_SKILLS.map((s) => s.name).sort());
    expect(result.preserved_unmanaged).toEqual([]);

    const skills = await discoverSkills(repo.repoRoot);
    expect(skills).toHaveLength(MANAGED_SKILLS.length);
    expect(skills.every((s) => s.managed)).toBe(true);
  });

  it("refreshes managed bodies in place while preserving unmanaged skills", async () => {
    const repo = await createTempRepo();
    await scaffoldManagedSkills(repo.repoRoot);

    // user edits a managed skill and adds an unmanaged one
    const managedPath = path.join(repo.repoRoot, ".reffy", "skills", "diagnose", "SKILL.md");
    await writeFile(managedPath, "tampered", "utf8");
    await writeSkill(repo.repoRoot, "my-skill", ['---', 'name: my-skill', 'description: mine', 'triggers: ["x"]', 'managed: false', '---', 'body'].join("\n"));

    const result = await scaffoldManagedSkills(repo.repoRoot);
    expect(result.created_dir).toBe(false);
    expect(result.preserved_unmanaged).toEqual(["my-skill"]);

    expect(await readFile(managedPath, "utf8")).not.toBe("tampered");
    expect(await readFile(path.join(repo.repoRoot, ".reffy", "skills", "my-skill", "SKILL.md"), "utf8")).toContain("body");
  });
});

describe("validateSkills", () => {
  it("accepts scaffolded managed skills", async () => {
    const repo = await createTempRepo();
    await scaffoldManagedSkills(repo.repoRoot);
    const result = await validateSkills(repo.repoRoot);
    expect(result.ok).toBe(true);
    expect(result.skill_count).toBe(MANAGED_SKILLS.length);
  });

  it("flags missing description, empty triggers, and name/dir mismatch", async () => {
    const repo = await createTempRepo();
    await writeSkill(repo.repoRoot, "broken", ['---', 'name: wrong-name', 'triggers: []', 'managed: false', '---', 'body'].join("\n"));
    const result = await validateSkills(repo.repoRoot);
    expect(result.ok).toBe(false);
    const fields = result.issues.map((i) => i.field);
    expect(fields).toContain("description");
    expect(fields).toContain("triggers");
    expect(fields).toContain("name");
  });

  it("flags a not-found named skill", async () => {
    const repo = await createTempRepo();
    const result = await validateSkills(repo.repoRoot, "nope");
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain("not found");
  });
});

describe("createSkill", () => {
  it("scaffolds an unmanaged skill that validates", async () => {
    const repo = await createTempRepo();
    const result = await createSkill(repo.repoRoot, "my-workflow");
    expect(result.created).toBe(true);
    const skills = await discoverSkills(repo.repoRoot);
    expect(skills.find((s) => s.name === "my-workflow")?.managed).toBe(false);
    expect((await validateSkills(repo.repoRoot, "my-workflow")).ok).toBe(true);
  });

  it("rejects reserved managed names and non-kebab names", async () => {
    const repo = await createTempRepo();
    await expect(createSkill(repo.repoRoot, "create-change")).rejects.toThrow(/reserved/);
    await expect(createSkill(repo.repoRoot, "Not Kebab")).rejects.toThrow(/kebab/);
  });
});

describe("command-reference staleness", () => {
  it("recognizes known commands with flags and rejects unknown ones", () => {
    expect(isKnownCommand("reffy plan create --change-id x")).toBe(true);
    expect(isKnownCommand("reffy skill validate")).toBe(true);
    expect(isKnownCommand("reffy frobnicate")).toBe(false);
  });

  it("reports drift only for unknown declared commands", async () => {
    const repo = await createTempRepo();
    await writeSkill(repo.repoRoot, "drifty", ['---', 'name: drifty', 'description: d', 'triggers: ["t"]', 'commands: ["reffy doctor", "reffy frobnicate"]', 'managed: false', '---', 'body'].join("\n"));
    const drift = await findCommandDrift(repo.repoRoot);
    expect(drift).toEqual([{ skill: "drifty", command: "reffy frobnicate" }]);
  });
});
