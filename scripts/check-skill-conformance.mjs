import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createSkill, discoverSkills, scaffoldManagedSkills, validateSkills } from "../dist/skills.js";

const repo = await mkdtemp(path.join(tmpdir(), "reffy-conformance-"));
try {
  await scaffoldManagedSkills(repo);
  await createSkill(repo, "custom-workflow");
  const customPath = path.join(repo, ".reffy/skills/custom-workflow/SKILL.md");
  await writeFile(customPath, (await readFile(customPath, "utf8"))
    .replace("One-line summary of what this skill does.", "Capture research notes. Use when asked to preserve exploratory context.")
    .replace("Describe the situation in which an agent should follow this skill.", "Use when capturing a short research note before formal planning."));
  // Exercise portable names beyond ASCII against the same pinned oracle.
  for (const name of ["données", "分析", "𐐨-数据"]) {
    const dir = path.join(repo, ".reffy/skills", name);
    await mkdir(dir);
    await writeFile(path.join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: Use when capturing research notes.\n---\nInstructions.\n`);
  }
  const result = await validateSkills(repo, undefined, { standard: true });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  const validator = process.env.SKILLS_REF_BIN || "skills-ref";
  const skills = await discoverSkills(repo);
  for (const skill of skills) {
    const check = spawnSync(validator, ["validate", skill.dir], { encoding: "utf8" });
    if (check.error) throw check.error;
    if (check.status !== 0) throw new Error(`${skill.name}: ${check.stdout}\n${check.stderr}`);
  }
  console.log(`Conformance passed: ${skills.length} generated and Unicode skill fixtures (Reffy strict + pinned skills-ref).`);
} finally {
  await rm(repo, { recursive: true, force: true });
}
