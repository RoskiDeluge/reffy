import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = await mkdtemp(path.join(tmpdir(), "reffy-workflows-"));
const cli = path.resolve("dist/cli.js");
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PASEO_")));
function run(args, expected = 0) {
  const result = spawnSync(process.execPath, [cli, ...args, "--repo", repo, "--output", "json"], { encoding: "utf8", env });
  if (result.error) throw result.error;
  assert.equal(result.status, expected, `${args.join(" ")}: ${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}
async function completeTasks(dir) {
  const filename = path.join(dir, "tasks.md");
  await writeFile(filename, (await readFile(filename, "utf8")).replaceAll("- [ ]", "- [x]"));
}
try {
  run(["init"]);
  const catalog = run(["skill", "list"]).skills.map(({ name, description, location }) => ({ name, description, location }));
  assert.equal(catalog.length, 7);
  for (const skill of catalog) assert.match(await readFile(skill.location, "utf8"), /## Steps/);
  await writeFile(path.join(repo, ".reffy/artifacts/evaluation-note.md"), "# Evaluation idea\nCapture a sample workflow for testing.\n");
  run(["reindex"]); assert.equal(run(["validate"]).artifact_count, 1);
  run(["plan", "create", "--change-id", "add-evaluation", "--artifacts", "evaluation-note.md", "--title", "Add evaluation"]);
  run(["plan", "validate", "add-evaluation"]);
  const changeDir = path.join(repo, ".reffy/reffyspec/changes/add-evaluation");
  await completeTasks(changeDir);
  run(["plan", "archive", "add-evaluation"]);
  assert.equal(run(["spec", "list"]).specs.length, 1);
  run(["spec", "show", "evaluation"]);
  const specPath = path.join(repo, ".reffy/reffyspec/specs/evaluation/spec.md");
  const canonical = await readFile(specPath, "utf8");
  const title = /^### Requirement: (.+)$/m.exec(canonical)[1];
  run(["plan", "list"]);
  run(["plan", "create", "--change-id", "update-evaluation", "--title", "Update evaluation"]);
  const pivotDir = path.join(repo, ".reffy/reffyspec/changes/update-evaluation");
  const proposal = path.join(pivotDir, "proposal.md");
  await writeFile(proposal, (await readFile(proposal, "utf8")).replace(/\nNone\n/, "\n- add-evaluation\n"));
  await writeFile(path.join(pivotDir, "specs/evaluation/spec.md"), `## MODIFIED Requirements\n\n### Requirement: ${title}\nThe system SHALL support the revised evaluation workflow.\n\n#### Scenario: Revised behavior\n- **WHEN** the evaluation runs\n- **THEN** revised behavior is exercised\n`);
  run(["plan", "validate", "update-evaluation"]);
  await completeTasks(pivotDir);
  run(["plan", "archive", "update-evaluation"]);
  assert.match(await readFile(specPath, "utf8"), /revised evaluation workflow/);
  assert.equal(run(["doctor"]).status, "ok");
  // Only fail-fast remote preflight is exercised. No remote publication is attempted.
  const remote = run(["remote", "status"], 1);
  assert.equal(remote.status, "error");
  const exported = run(["skill", "export", "--target", "agents"]);
  assert.equal(exported.written.length, 7);
  for (const skill of catalog) {
    assert.equal(await readFile(path.join(repo, ".agents/skills", skill.name, "SKILL.md"), "utf8"), await readFile(skill.location, "utf8"));
  }
  assert.equal(run(["skill", "export", "--target", "agents"]).written.length, 0);
  console.log("Workflow smoke passed: artifact capture, change creation, archive, spec inspection, superseding modification, doctor, remote fail-fast preflight, and native export/file loading.");
  console.log("Native client discovery/activation remains unverified: this script checks exported layout and file loading only.");
} finally {
  await rm(repo, { recursive: true, force: true });
}
