import { execFile, spawn } from "node:child_process";
import { access, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { addArtifact, createTempRepo, createTempRepoWithRefsDir } from "./helpers.js";

const execFileAsync = promisify(execFile);
const CLI_PATH = path.join(process.cwd(), "dist/cli.js");

async function runCli(args: string[], cwd = process.cwd()): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync("node", [CLI_PATH, ...args], {
      cwd,
      env: process.env,
    });
    return { stdout, stderr, code: 0 };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; code?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", code: e.code ?? 1 };
  }
}

async function runCliWithStdin(
  args: string[],
  input: string,
  cwd = process.cwd(),
): Promise<{ stdout: string; stderr: string; code: number }> {
  return await new Promise((resolve) => {
    const child = spawn("node", [CLI_PATH, ...args], {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

async function createPlanningChange(
  repoRoot: string,
  changeId: string,
  options?: { invalidSpec?: boolean; checkedTasks?: boolean },
): Promise<void> {
  const changeDir = path.join(repoRoot, "reffyspec", "changes", changeId);
  const specDir = path.join(changeDir, "specs", "demo");
  await mkdir(specDir, { recursive: true });

  await writeFile(
    path.join(changeDir, "proposal.md"),
    [
      `# Change: ${changeId}`,
      "",
      "## Why",
      "Need native planning runtime support.",
      "",
      "## What Changes",
      "- Add native planning validation",
      "",
      "## Impact",
      "- Affected specs: `demo`",
      "- Affected code: planning runtime",
    ].join("\n"),
    "utf8",
  );

  await writeFile(
    path.join(changeDir, "tasks.md"),
    [
      "## 1. Implementation",
      `- [${options?.checkedTasks ? "x" : " "}] 1.1 Add parser`,
      "- [ ] 1.2 Add validation",
    ].join("\n"),
    "utf8",
  );

  await writeFile(path.join(changeDir, "design.md"), "## Context\nRuntime replacement.\n", "utf8");

  await writeFile(
    path.join(specDir, "spec.md"),
    options?.invalidSpec
      ? [
          "## ADDED Requirements",
          "### Requirement: Demo",
          "The system SHALL validate planning changes.",
          "",
          "### Scenario: Wrong heading",
          "- **WHEN** a user runs validation",
          "- **THEN** it fails formatting checks",
        ].join("\n")
      : [
          "## ADDED Requirements",
          "### Requirement: Demo",
          "The system SHALL validate planning changes.",
          "",
          "#### Scenario: Validation succeeds",
          "- **WHEN** a user runs validation",
          "- **THEN** the change passes structural checks",
        ].join("\n"),
    "utf8",
  );
}

async function createCurrentSpec(
  repoRoot: string,
  specId: string,
  options?: { withDesign?: boolean },
): Promise<void> {
  const specDir = path.join(repoRoot, "reffyspec", "specs", specId);
  await mkdir(specDir, { recursive: true });
  await writeFile(
    path.join(specDir, "spec.md"),
    [
      `# ${specId} Specification`,
      "",
      "## Purpose",
      `Purpose for ${specId}.`,
      "",
      "## Requirements",
      "### Requirement: Demo Requirement",
      "The system SHALL expose the current spec for inspection.",
      "",
      "#### Scenario: Show the spec",
      "- **WHEN** a user runs spec show",
      "- **THEN** the command returns the current spec content",
    ].join("\n"),
    "utf8",
  );

  if (options?.withDesign) {
    await writeFile(path.join(specDir, "design.md"), "## Design\nSpec design notes.\n", "utf8");
  }
}

async function overwriteFile(targetPath: string, content: string): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, "utf8");
}

describe("cli summarize", () => {
  it("prints structured text output", async () => {
    const repo = await createTempRepo();
    await addArtifact(repo, {
      filename: "idea.md",
      content: "# Feature Idea: Summary\n\n## Open Questions\n- Should this print?",
    });

    const result = await runCli(["summarize", "--repo", repo.repoRoot, "--output", "text"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Themes:");
    expect(result.stdout).toContain("Open Questions:");
    expect(result.stdout).toContain("Suggested Reffy References:");
    expect(result.stdout).not.toContain("__  __");
  });

  it("returns machine-readable json output", async () => {
    const repo = await createTempRepo();
    await addArtifact(repo, {
      filename: "idea.md",
      content: "# Feature Idea: Summary\n\n## Proposed Feature\n- `reffy summarize`",
    });

    const result = await runCli(["summarize", "--repo", repo.repoRoot, "--output", "json"]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      status: string;
      command: string;
      themes: string[];
      suggested_reffy_references: Array<{ filename: string }>;
    };
    expect(parsed.status).toBe("ok");
    expect(parsed.command).toBe("summarize");
    expect(parsed.themes.length).toBeGreaterThan(0);
    expect(parsed.suggested_reffy_references[0]?.filename).toBe("idea.md");
  });

  it("fails summarize when manifest is invalid", async () => {
    const repo = await createTempRepo();
    await writeFile(path.join(repo.manifestPath), "not-json", "utf8");

    const textResult = await runCli(["summarize", "--repo", repo.repoRoot, "--output", "text"]);
    expect(textResult.code).toBe(1);
    expect(textResult.stderr).toContain("Cannot summarize: manifest invalid");

    const jsonResult = await runCli(["summarize", "--repo", repo.repoRoot, "--output", "json"]);
    expect(jsonResult.code).toBe(1);
    const parsed = JSON.parse(jsonResult.stdout) as { status: string; command: string; ok: boolean };
    expect(parsed.status).toBe("error");
    expect(parsed.command).toBe("summarize");
    expect(parsed.ok).toBe(false);
  });
});

describe("cli init", () => {
  it("prints ASCII banner in text output", async () => {
    const repo = await createTempRepo();
    const result = await runCli(["init", "--repo", repo.repoRoot, "--output", "text"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("__  __");
    expect(result.stdout).toContain("Updated");
  });

  it("writes AGENTS content that describes Reffy as ideation plus planning", async () => {
    const repo = await createTempRepo();
    const result = await runCli(["init", "--repo", repo.repoRoot, "--output", "json"]);
    expect(result.code).toBe(0);

    const rootAgents = await readFile(path.join(repo.repoRoot, "AGENTS.md"), "utf8");
    const reffyAgents = await readFile(path.join(repo.repoRoot, ".reffy", "AGENTS.md"), "utf8");
    const reffyspecAgents = await readFile(path.join(repo.repoRoot, "reffyspec", "AGENTS.md"), "utf8");

    expect(rootAgents).toContain("owns the runtime");
    expect(rootAgents).toContain("`@/reffyspec/AGENTS.md`");
    expect(reffyAgents).toContain("Reffy owns ideation artifacts, manifest metadata, and native planning scaffolds.");
    expect(reffyAgents).toContain("Reffy is the primary runtime authority for this project.");
    expect(reffyAgents).toContain("ReffySpec files live under `reffyspec/` as the canonical planning layout.");
    expect(reffyspecAgents).toContain("`reffyspec/specs/`");
  });
});

describe("cli version", () => {
  it("prints the installed package version", async () => {
    const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8")) as { version: string };

    const result = await runCli(["--version"]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim()).toBe(packageJson.version);
  });
});

describe("cli repo-root discovery", () => {
  it("uses the repository root when commands run from .reffy/artifacts", async () => {
    const repo = await createTempRepo();
    const cwd = repo.artifactsDir;
    const nestedRefsPath = path.join(repo.artifactsDir, ".reffy");

    const reindex = await runCli(["reindex", "--output", "json"], cwd);
    expect(reindex.code).toBe(0);

    const validate = await runCli(["validate", "--output", "json"], cwd);
    expect(validate.code).toBe(0);

    const summarize = await runCli(["summarize", "--output", "json"], cwd);
    expect(summarize.code).toBe(0);

    const doctor = await runCli(["doctor", "--output", "json"], cwd);
    expect(doctor.code).toBe(0);

    const init = await runCli(["init", "--output", "json"], cwd);
    expect(init.code).toBe(0);

    const bootstrap = await runCli(["bootstrap", "--output", "json"], repo.repoRoot);
    expect(bootstrap.code).toBe(0);

    const initPayload = JSON.parse(init.stdout) as { root_agents_path: string; reffy_agents_path: string; reffyspec_agents_path: string };
    expect(await realpath(initPayload.root_agents_path)).toBe(await realpath(path.join(repo.repoRoot, "AGENTS.md")));
    expect(await realpath(initPayload.reffy_agents_path)).toBe(
      await realpath(path.join(repo.repoRoot, ".reffy", "AGENTS.md")),
    );
    expect(await realpath(initPayload.reffyspec_agents_path)).toBe(
      await realpath(path.join(repo.repoRoot, "reffyspec", "AGENTS.md")),
    );

    const bootstrapPayload = JSON.parse(bootstrap.stdout) as { refs_dir: string; manifest_path: string };
    expect(await realpath(bootstrapPayload.refs_dir)).toBe(await realpath(path.join(repo.repoRoot, ".reffy")));
    expect(await realpath(bootstrapPayload.manifest_path)).toBe(
      await realpath(path.join(repo.repoRoot, ".reffy", "manifest.json")),
    );

    await expect(access(nestedRefsPath)).rejects.toThrow();
  });

  it("uses the repository root when commands run from .references/artifacts", async () => {
    const repo = await createTempRepoWithRefsDir(".references");
    const cwd = repo.artifactsDir;
    const nestedRefsPath = path.join(repo.artifactsDir, ".reffy");

    const reindex = await runCli(["reindex", "--output", "json"], cwd);
    expect(reindex.code).toBe(0);

    const validate = await runCli(["validate", "--output", "json"], cwd);
    expect(validate.code).toBe(0);

    const summarize = await runCli(["summarize", "--output", "json"], cwd);
    expect(summarize.code).toBe(0);

    const doctor = await runCli(["doctor", "--output", "json"], cwd);
    expect(doctor.code).toBe(0);

    const init = await runCli(["init", "--output", "json"], cwd);
    expect(init.code).toBe(0);

    const bootstrap = await runCli(["bootstrap", "--output", "json"], repo.repoRoot);
    expect(bootstrap.code).toBe(0);

    const initPayload = JSON.parse(init.stdout) as { root_agents_path: string; reffy_agents_path: string; reffyspec_agents_path: string };
    expect(await realpath(initPayload.root_agents_path)).toBe(await realpath(path.join(repo.repoRoot, "AGENTS.md")));
    expect(await realpath(initPayload.reffy_agents_path)).toBe(
      await realpath(path.join(repo.repoRoot, ".reffy", "AGENTS.md")),
    );
    expect(await realpath(initPayload.reffyspec_agents_path)).toBe(
      await realpath(path.join(repo.repoRoot, "reffyspec", "AGENTS.md")),
    );

    const bootstrapPayload = JSON.parse(bootstrap.stdout) as { refs_dir: string; manifest_path: string };
    expect(await realpath(bootstrapPayload.refs_dir)).toBe(await realpath(path.join(repo.repoRoot, ".reffy")));
    expect(await realpath(bootstrapPayload.manifest_path)).toBe(
      await realpath(path.join(repo.repoRoot, ".reffy", "manifest.json")),
    );

    await expect(access(nestedRefsPath)).rejects.toThrow();
    await expect(access(path.join(repo.repoRoot, ".references"))).rejects.toThrow();
  });
});

describe("cli legacy .references compatibility", () => {
  it("migrates a legacy .references repo to .reffy during init", async () => {
    const repo = await createTempRepoWithRefsDir(".references");

    const init = await runCli(["init", "--repo", repo.repoRoot, "--output", "json"]);
    expect(init.code).toBe(0);

    const rootAgents = await readFile(path.join(repo.repoRoot, "AGENTS.md"), "utf8");
    const refsAgents = await readFile(path.join(repo.repoRoot, ".reffy", "AGENTS.md"), "utf8");

    expect(rootAgents).toContain("`@/.reffy/AGENTS.md`");
    expect(rootAgents).toContain("`@/reffyspec/AGENTS.md`");
    expect(refsAgents).toContain("`.reffy/artifacts/`");
    await expect(access(path.join(repo.repoRoot, ".references"))).rejects.toThrow();
  });

  it("migrates a legacy openspec planning layout to reffyspec during init", async () => {
    const repo = await createTempRepo();
    await mkdir(path.join(repo.repoRoot, "openspec", "changes", "archive"), { recursive: true });
    await mkdir(path.join(repo.repoRoot, "openspec", "specs", "demo"), { recursive: true });
    await writeFile(path.join(repo.repoRoot, "openspec", "specs", "demo", "spec.md"), "# demo Specification\n", "utf8");

    const init = await runCli(["init", "--repo", repo.repoRoot, "--output", "json"]);
    expect(init.code).toBe(0);

    await expect(access(path.join(repo.repoRoot, "openspec"))).rejects.toThrow();
    expect(await readFile(path.join(repo.repoRoot, "reffyspec", "specs", "demo", "spec.md"), "utf8")).toContain("# demo Specification");
  });

  it("exposes explicit migration as a command", async () => {
    const repo = await createTempRepoWithRefsDir(".references");

    const result = await runCli(["migrate", "--repo", repo.repoRoot, "--output", "json"]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as { command: string; migrated_workspace: boolean; refs_dir: string };
    expect(parsed.command).toBe("migrate");
    expect(parsed.migrated_workspace).toBe(true);
    expect(await realpath(parsed.refs_dir)).toBe(await realpath(path.join(repo.repoRoot, ".reffy")));
    await expect(access(path.join(repo.repoRoot, ".references"))).rejects.toThrow();
  });
});

describe("cli doctor", () => {
  it("prints required/optional sections in text mode", async () => {
    const repo = await createTempRepo();
    const result = await runCli(["doctor", "--repo", repo.repoRoot, "--output", "text"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Required Checks:");
    expect(result.stdout).toContain("Optional Checks:");
    expect(result.stdout).toContain("Summary:");
  });

  it("returns structured json payload", async () => {
    const repo = await createTempRepo();
    const result = await runCli(["doctor", "--repo", repo.repoRoot, "--output", "json"]);

    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      status: string;
      command: string;
      checks: Array<{ id: string; level: string; ok: boolean; message: string }>;
      summary: { required_failed: number };
    };
    expect(parsed.status).toBe("ok");
    expect(parsed.command).toBe("doctor");
    expect(parsed.summary.required_failed).toBe(0);
    expect(parsed.checks.some((check) => check.id === "manifest_valid")).toBe(true);
  });

  it("returns non-zero when required checks fail", async () => {
    const repo = await createTempRepo();
    await writeFile(repo.manifestPath, "not-json", "utf8");

    const result = await runCli(["doctor", "--repo", repo.repoRoot, "--output", "json"]);
    expect(result.code).toBe(1);
    const parsed = JSON.parse(result.stdout) as { status: string; summary: { required_failed: number } };
    expect(parsed.status).toBe("error");
    expect(parsed.summary.required_failed).toBeGreaterThan(0);
  });
});

describe("cli diagram render", () => {
  it("renders svg from stdin", async () => {
    const result = await runCliWithStdin(
      ["diagram", "render", "--format", "svg", "--stdin"],
      "graph TD\n  A[Start] --> B[End]\n",
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("<svg");
  });

  it("renders ascii from stdin", async () => {
    const result = await runCliWithStdin(
      ["diagram", "render", "--format", "ascii", "--stdin"],
      "graph LR\n  A --> B\n",
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("A");
    expect(result.stdout).toContain("B");
  });

  it("derives diagram relationships from generated spec.md input", async () => {
    const repo = await createTempRepo();
    const specDir = path.join(repo.repoRoot, "reffyspec", "specs", "demo");
    const specPath = path.join(specDir, "spec.md");
    await mkdir(specDir, { recursive: true });
    await writeFile(
      specPath,
      [
        "# demo Specification",
        "",
        "## Requirements",
        "### Requirement: User Login",
        "The system SHALL support login.",
        "",
        "#### Scenario: Valid credentials",
        "- **WHEN** the user submits correct credentials",
        "- **THEN** authentication succeeds",
      ].join("\n"),
      "utf8",
    );

    const result = await runCli(["diagram", "render", "--repo", repo.repoRoot, "--input", "reffyspec/specs/demo/spec.md", "--format", "ascii"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Requirement: User Login");
    expect(result.stdout).toContain("Scenario: Valid credentials");
  });

  it("writes output to file when --output is provided", async () => {
    const repo = await createTempRepo();
    const result = await runCliWithStdin(
      ["diagram", "render", "--repo", repo.repoRoot, "--stdin", "--format", "svg", "--output", "out/diagram.svg"],
      "graph TD\n  A --> B\n",
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Wrote svg diagram to");
    const written = await readFile(path.join(repo.repoRoot, "out", "diagram.svg"), "utf8");
    expect(written).toContain("<svg");
  });

  it("fails for invalid mermaid input", async () => {
    const result = await runCliWithStdin(["diagram", "render", "--format", "svg", "--stdin"], "not-a-mermaid-diagram");
    expect(result.code).toBe(1);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it("fails for malformed spec.md input", async () => {
    const repo = await createTempRepo();
    const specDir = path.join(repo.repoRoot, "reffyspec", "specs", "broken");
    await mkdir(specDir, { recursive: true });
    await writeFile(path.join(specDir, "spec.md"), "# broken spec\n\nNo requirement headings here.\n", "utf8");

    const result = await runCli(["diagram", "render", "--repo", repo.repoRoot, "--input", "reffyspec/specs/broken/spec.md", "--format", "ascii"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Unable to derive diagram from spec.md");
  });
});

describe("cli plan create", () => {
  it("creates ReffySpec scaffolds from indexed artifacts and records traceability", async () => {
    const repo = await createTempRepo();
    await addArtifact(repo, {
      filename: "idea.md",
      content: [
        "# Feature Idea",
        "",
        "## Problem",
        "Users need a more direct path from ideation to planning.",
        "",
        "## Proposed Feature",
        "- Generate proposal scaffolds directly from artifacts",
        "- Link generated outputs back to the manifest",
        "",
        "## Open Questions",
        "- Should the generated design file include artifact-derived goals?",
        "",
        "## Acceptance Criteria",
        "- the generated proposal includes Reffy References",
      ].join("\n"),
    });

    const result = await runCli(
      ["plan", "create", "--repo", repo.repoRoot, "--change-id", "add-planning-subsystem", "--artifacts", "idea.md", "--output", "json"],
    );
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      command: string;
      subcommand: string;
      selected_artifacts: string[];
      written_files: string[];
    };
    expect(parsed.command).toBe("plan");
    expect(parsed.subcommand).toBe("create");
    expect(parsed.selected_artifacts).toEqual(["idea.md"]);
    expect(parsed.written_files).toContain("reffyspec/changes/add-planning-subsystem/proposal.md");

    const proposal = await readFile(path.join(repo.repoRoot, "reffyspec", "changes", "add-planning-subsystem", "proposal.md"), "utf8");
    expect(proposal).toContain("## Reffy References");
    expect(proposal).toContain("idea.md");
    expect(proposal).toContain("Users need a more direct path from ideation to planning.");
    expect(proposal).toContain("Generate proposal scaffolds directly from artifacts");

    const tasks = await readFile(path.join(repo.repoRoot, "reffyspec", "changes", "add-planning-subsystem", "tasks.md"), "utf8");
    expect(tasks).toContain("Generate proposal scaffolds directly from artifacts");
    expect(tasks).toContain("Link generated outputs back to the manifest");

    const design = await readFile(path.join(repo.repoRoot, "reffyspec", "changes", "add-planning-subsystem", "design.md"), "utf8");
    expect(design).toContain("Should the generated design file include artifact-derived goals?");

    const spec = await readFile(
      path.join(repo.repoRoot, "reffyspec", "changes", "add-planning-subsystem", "specs", "planning-subsystem", "spec.md"),
      "utf8",
    );
    expect(spec).toContain("The system SHALL generate proposal scaffolds directly from artifacts.");
    expect(spec).toContain("- **WHEN** the generated proposal includes Reffy References");

    const manifestText = await readFile(repo.manifestPath, "utf8");
    expect(manifestText).toContain("\"related_changes\"");
    expect(manifestText).toContain("\"derived_outputs\"");
    expect(manifestText).toContain("add-planning-subsystem");
  });

  it("synthesizes multiple artifacts into a single proposal and design context", async () => {
    const repo = await createTempRepo();
    await addArtifact(repo, {
      filename: "problem.md",
      content: [
        "# Problem",
        "",
        "## Problem",
        "Planning notes and generated changes drift apart too easily.",
        "",
        "## Open Questions",
        "- Should we surface linked outputs in list/show views later?",
      ].join("\n"),
    });
    await addArtifact(repo, {
      filename: "solution.md",
      content: [
        "# Solution",
        "",
        "## Proposed Feature",
        "- Generate stronger proposal and design summaries from artifact text",
        "- Reduce boilerplate in generated planning files",
        "",
        "## Acceptance Criteria",
        "- the generated proposal summarizes the source problem clearly",
      ].join("\n"),
    });

    const result = await runCli(
      [
        "plan",
        "create",
        "--repo",
        repo.repoRoot,
        "--change-id",
        "update-planning-synthesis",
        "--artifacts",
        "problem.md,solution.md",
        "--output",
        "json",
      ],
    );
    expect(result.code).toBe(0);

    const proposal = await readFile(
      path.join(repo.repoRoot, "reffyspec", "changes", "update-planning-synthesis", "proposal.md"),
      "utf8",
    );
    expect(proposal).toContain("Planning notes and generated changes drift apart too easily.");
    expect(proposal).toContain("Generate stronger proposal and design summaries from artifact text");
    expect(proposal).toContain("Reduce boilerplate in generated planning files");
    expect(proposal).toContain("problem.md");
    expect(proposal).toContain("solution.md");

    const design = await readFile(
      path.join(repo.repoRoot, "reffyspec", "changes", "update-planning-synthesis", "design.md"),
      "utf8",
    );
    expect(design).toContain("### Problem Summary");
    expect(design).toContain("Planning notes and generated changes drift apart too easily.");
    expect(design).toContain("Should we surface linked outputs in list/show views later?");
  });
});

describe("cli plan validate/list/show", () => {
  it("validates a well-formed planning change", async () => {
    const repo = await createTempRepo();
    await createPlanningChange(repo.repoRoot, "add-native-validate", { checkedTasks: true });

    const result = await runCli(["plan", "validate", "add-native-validate", "--repo", repo.repoRoot, "--output", "json"]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      status: string;
      subcommand: string;
      ok: boolean;
      delta_count: number;
      task_status: { total: number; completed: number };
    };
    expect(parsed.status).toBe("ok");
    expect(parsed.subcommand).toBe("validate");
    expect(parsed.ok).toBe(true);
    expect(parsed.delta_count).toBe(1);
    expect(parsed.task_status.completed).toBe(1);
  });

  it("reports invalid planning spec formatting", async () => {
    const repo = await createTempRepo();
    await createPlanningChange(repo.repoRoot, "add-bad-format", { invalidSpec: true });

    const result = await runCli(["plan", "validate", "add-bad-format", "--repo", repo.repoRoot, "--output", "json"]);
    expect(result.code).toBe(1);
    const parsed = JSON.parse(result.stdout) as { status: string; ok: boolean; errors: string[] };
    expect(parsed.status).toBe("error");
    expect(parsed.ok).toBe(false);
    expect(parsed.errors.join("\n")).toContain('scenarios must use "#### Scenario:" headings');
  });

  it("lists active planning changes with task and delta summaries", async () => {
    const repo = await createTempRepo();
    await createPlanningChange(repo.repoRoot, "add-alpha", { checkedTasks: true });
    await createPlanningChange(repo.repoRoot, "add-beta");

    const result = await runCli(["plan", "list", "--repo", repo.repoRoot, "--output", "json"]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      status: string;
      subcommand: string;
      changes: Array<{ id: string; delta_count: number; task_status: { total: number; completed: number } }>;
    };
    expect(parsed.status).toBe("ok");
    expect(parsed.subcommand).toBe("list");
    expect(parsed.changes.map((change) => change.id)).toEqual(["add-alpha", "add-beta"]);
    expect(parsed.changes[0]?.delta_count).toBe(1);
    expect(parsed.changes[0]?.task_status.completed).toBe(1);
  });

  it("shows active planning change contents", async () => {
    const repo = await createTempRepo();
    await createPlanningChange(repo.repoRoot, "add-show-demo");

    const result = await runCli(["plan", "show", "add-show-demo", "--repo", repo.repoRoot, "--output", "json"]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      status: string;
      subcommand: string;
      change: { id: string; proposal: string; tasks: string; specs: Array<{ capability: string; content: string }> };
    };
    expect(parsed.status).toBe("ok");
    expect(parsed.subcommand).toBe("show");
    expect(parsed.change.id).toBe("add-show-demo");
    expect(parsed.change.proposal).toContain("## Why");
    expect(parsed.change.tasks).toContain("## 1. Implementation");
    expect(parsed.change.specs[0]?.capability).toBe("demo");
    expect(parsed.change.specs[0]?.content).toContain("#### Scenario: Validation succeeds");
  });
});

describe("cli spec list/show", () => {
  it("lists current specs with requirement counts", async () => {
    const repo = await createTempRepo();
    await createCurrentSpec(repo.repoRoot, "alpha-spec");
    await createCurrentSpec(repo.repoRoot, "beta-spec");

    const result = await runCli(["spec", "list", "--repo", repo.repoRoot, "--output", "json"]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      status: string;
      subcommand: string;
      specs: Array<{ id: string; requirement_count: number; purpose?: string }>;
    };
    expect(parsed.status).toBe("ok");
    expect(parsed.subcommand).toBe("list");
    expect(parsed.specs.map((spec) => spec.id)).toEqual(["alpha-spec", "beta-spec"]);
    expect(parsed.specs[0]?.requirement_count).toBe(1);
    expect(parsed.specs[0]?.purpose).toBe("Purpose for alpha-spec.");
  });

  it("shows current spec content and optional design", async () => {
    const repo = await createTempRepo();
    await createCurrentSpec(repo.repoRoot, "show-spec", { withDesign: true });

    const result = await runCli(["spec", "show", "show-spec", "--repo", repo.repoRoot, "--output", "json"]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      status: string;
      subcommand: string;
      spec: { id: string; title: string; purpose?: string; spec: string; design?: string };
    };
    expect(parsed.status).toBe("ok");
    expect(parsed.subcommand).toBe("show");
    expect(parsed.spec.id).toBe("show-spec");
    expect(parsed.spec.title).toBe("show-spec");
    expect(parsed.spec.purpose).toBe("Purpose for show-spec.");
    expect(parsed.spec.spec).toContain("### Requirement: Demo Requirement");
    expect(parsed.spec.design).toContain("## Design");
  });
});

describe("cli plan archive", () => {
  it("archives an active change, updates current spec state, and preserves manifest traceability", async () => {
    const repo = await createTempRepo();
    await addArtifact(repo, {
      filename: "archive-input.md",
      content: [
        "# Archive Input",
        "",
        "## Problem",
        "Users need a native archive command inside Reffy.",
        "",
        "## Proposed Feature",
        "- Generate native archive behavior for completed planning changes",
        "",
        "## Acceptance Criteria",
        "- the archived outputs remain linked in the manifest",
      ].join("\n"),
    });

    const createResult = await runCli(
      ["plan", "create", "--repo", repo.repoRoot, "--change-id", "add-archive-demo", "--artifacts", "archive-input.md", "--output", "json"],
    );
    expect(createResult.code).toBe(0);

    const archiveResult = await runCli(["plan", "archive", "add-archive-demo", "--repo", repo.repoRoot, "--output", "json"]);
    expect(archiveResult.code).toBe(0);
    const parsed = JSON.parse(archiveResult.stdout) as {
      status: string;
      subcommand: string;
      archive_dir: string;
      updated_specs: string[];
      linked_artifacts: number;
    };
    expect(parsed.status).toBe("ok");
    expect(parsed.subcommand).toBe("archive");
    expect(parsed.archive_dir).toMatch(/reffyspec[\\/]changes[\\/]archive[\\/]\d{4}-\d{2}-\d{2}-add-archive-demo$/);
    expect(parsed.updated_specs.some((entry) => entry.endsWith(path.join("reffyspec", "specs", "archive-demo", "spec.md")))).toBe(true);
    expect(parsed.linked_artifacts).toBe(1);

    await expect(access(path.join(repo.repoRoot, "reffyspec", "changes", "add-archive-demo"))).rejects.toThrow();

    const archivedProposalPath = path.join(parsed.archive_dir, "proposal.md");
    const currentSpecPath = path.join(repo.repoRoot, "reffyspec", "specs", "archive-demo", "spec.md");
    expect(await readFile(archivedProposalPath, "utf8")).toContain("# Change: Add Archive Demo");
    expect(await readFile(currentSpecPath, "utf8")).toContain("### Requirement: Archive Demo");

    const manifestText = await readFile(repo.manifestPath, "utf8");
    expect(manifestText).toContain("reffyspec/changes/archive/");
    expect(manifestText).not.toContain("reffyspec/changes/add-archive-demo/proposal.md");
  });

  it("appends supported archived requirements to an existing current spec", async () => {
    const repo = await createTempRepo();
    await createPlanningChange(repo.repoRoot, "add-demo");
    await createCurrentSpec(repo.repoRoot, "demo");

    const archiveResult = await runCli(["plan", "archive", "add-demo", "--repo", repo.repoRoot, "--output", "json"]);
    expect(archiveResult.code).toBe(0);

    const currentSpec = await readFile(path.join(repo.repoRoot, "reffyspec", "specs", "demo", "spec.md"), "utf8");
    expect(currentSpec).toContain("### Requirement: Demo Requirement");
    expect(currentSpec).toContain("### Requirement: Demo");
  });

  it("fails safely on unsupported delta section types", async () => {
    const repo = await createTempRepo();
    await createPlanningChange(repo.repoRoot, "add-unsupported-archive");
    await overwriteFile(
      path.join(repo.repoRoot, "reffyspec", "changes", "add-unsupported-archive", "specs", "demo", "spec.md"),
      [
        "## MODIFIED Requirements",
        "### Requirement: Demo",
        "The system SHALL archive modified requirements later.",
        "",
        "#### Scenario: Unsupported archive pattern",
        "- **WHEN** a user archives this change",
        "- **THEN** the command fails safely",
      ].join("\n"),
    );

    const archiveResult = await runCli(["plan", "archive", "add-unsupported-archive", "--repo", repo.repoRoot, "--output", "json"]);
    expect(archiveResult.code).toBe(1);
    expect(archiveResult.stdout || archiveResult.stderr).toContain("unsupported delta sections");
    await expect(access(path.join(repo.repoRoot, "reffyspec", "changes", "add-unsupported-archive"))).resolves.toBeUndefined();
  });
});
