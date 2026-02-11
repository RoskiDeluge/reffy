import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runDoctor } from "../src/doctor.js";
import { createTempRepo } from "./helpers.js";

describe("runDoctor", () => {
  it("passes required checks and warns for missing optional tools", async () => {
    const repo = await createTempRepo();
    const report = await runDoctor(repo.repoRoot, { checkOpenSpec: () => false });

    expect(report.summary.required_failed).toBe(0);
    expect(report.summary.optional_failed).toBe(1);
    expect(report.checks.find((check) => check.id === "openspec_available")?.ok).toBe(false);
  });

  it("fails required checks when expected files are missing", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "reffy-doctor-missing-"));
    await mkdir(path.join(repoRoot, ".references", "artifacts"), { recursive: true });
    await writeFile(path.join(repoRoot, ".references", "manifest.json"), "{}", "utf8");

    const report = await runDoctor(repoRoot, { checkOpenSpec: () => true });
    expect(report.summary.required_failed).toBeGreaterThan(0);
    expect(report.checks.find((check) => check.id === "root_agents_exists")?.ok).toBe(false);
    expect(report.checks.find((check) => check.id === "refs_agents_exists")?.ok).toBe(false);
    expect(report.checks.find((check) => check.id === "manifest_valid")?.ok).toBe(false);
  });
});
