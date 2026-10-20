import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkChangelog, compareVersions, parseChangelog, prepareRelease, releaseNotes } from "../scripts/changelog.mjs";

const exec = promisify(execFile);
const packageContent = JSON.stringify({ name: "reffy-cli", version: "1.9.5", private: false }, null, 2) + "\n";
const changelog = "# Changelog\n\nContext.\n\n## [Unreleased]\n\n### Added\n- New behavior.\n\n## [1.9.5] - 2026-10-01\n\n### Fixed\n- Historical fix.\n\n## [1.9.4] - 2026-09-10\n\n- Older behavior.\n";

describe("release changelog", () => {
  it("prepares a dated release, preserves history/metadata, and repeats without changes", () => {
    const prepared = prepareRelease(packageContent, changelog, "1.10.0", "2026-10-19");
    expect(JSON.parse(prepared.packageContent)).toEqual({ name: "reffy-cli", version: "1.10.0", private: false });
    expect(prepared.changelogContent).toContain("## [Unreleased]\n\n## [1.10.0] - 2026-10-19\n\n### Added\n- New behavior.");
    expect(prepared.changelogContent).toContain(changelog.slice(changelog.indexOf("## [1.9.5]")));
    expect(releaseNotes(prepared.changelogContent, "1.10.0", "v1.10.0")).toBe("### Added\n- New behavior.\n");
    expect(prepareRelease(prepared.packageContent, prepared.changelogContent, "1.10.0", "2026-10-20")).toEqual({ ...prepared, changed: false });
  });
  it.each(["1.9.4", "v1.9.6", "1.9", "01.9.6", "1.9.6-beta.1", "1.9.6; echo unsafe", ""]) ("rejects invalid/non-increasing next version %s", version => {
    expect(() => prepareRelease(packageContent, changelog, version)).toThrow();
  });
  it.each(["2026-02-30", "2026-13-01", "not-a-date", "2026-1-1"])("rejects invalid date %s", date => {
    expect(() => prepareRelease(packageContent, changelog, "1.9.6", date)).toThrow(/date/);
  });
  it("checks numeric ordering and supports a valid leap day", () => {
    expect(compareVersions("1.10.0", "1.9.9")).toBe(1);
    expect(compareVersions("2.0.0", "1.99.99")).toBe(1);
    expect(prepareRelease(packageContent, changelog, "1.9.6", "2028-02-29").changed).toBe(true);
    const invalid = changelog.replace("## [1.9.4]", "## [1.10.0]");
    expect(() => parseChangelog(invalid)).toThrow(/newest first/);
  });
  it("rejects duplicate/malformed releases and a missing Unreleased section", () => {
    expect(() => parseChangelog(changelog.replace("[1.9.4]", "[1.9.5]"))).toThrow(/unique/);
    expect(() => parseChangelog(changelog.replace("[1.9.5] - 2026-10-01", "v1.9.5"))).toThrow(/heading/);
    expect(() => parseChangelog(changelog.replace("[Unreleased]", "Unreleased"))).toThrow(/Unreleased/);
  });
  it("allows an empty Unreleased section but refuses to release it", () => {
    const empty = changelog.replace("### Added\n- New behavior.\n\n", "");
    expect(checkChangelog(empty, "1.9.5").sections).toHaveLength(3);
    expect(() => prepareRelease(packageContent, empty, "1.9.6")).toThrow(/Unreleased/);
  });
  it("rejects missing/empty release notes and tag/package mismatches", () => {
    expect(() => checkChangelog(changelog, "1.9.6")).toThrow(/match/);
    expect(() => releaseNotes(changelog, "1.9.5", "v1.9.6")).toThrow(/Tag/);
    expect(() => checkChangelog(changelog.replace("- Historical fix.", ""), "1.9.5")).toThrow(/no changelog notes/);
  });
  it("runs local preparation/extraction and leaves both files unchanged on invalid input", async () => {
    const repo = await mkdtemp(path.join(tmpdir(), "reffy-release-"));
    const script = path.resolve("scripts/changelog.mjs");
    await writeFile(path.join(repo, "package.json"), packageContent);
    await writeFile(path.join(repo, "CHANGELOG.md"), changelog);
    await expect(exec(process.execPath, [script, "prepare", "1.8.0"], { cwd: repo })).rejects.toThrow();
    expect(await readFile(path.join(repo, "package.json"), "utf8")).toBe(packageContent);
    expect(await readFile(path.join(repo, "CHANGELOG.md"), "utf8")).toBe(changelog);
    await exec(process.execPath, [script, "prepare", "1.9.6"], { cwd: repo });
    expect((await exec(process.execPath, [script, "check"], { cwd: repo })).stdout).toContain("1.9.6");
    expect((await exec(process.execPath, [script, "notes", "v1.9.6"], { cwd: repo })).stdout).toBe("### Added\n- New behavior.\n");
    const prepared = await readFile(path.join(repo, "CHANGELOG.md"), "utf8");
    await exec(process.execPath, [script, "prepare", "1.9.6"], { cwd: repo });
    expect(await readFile(path.join(repo, "CHANGELOG.md"), "utf8")).toBe(prepared);
  });
});
