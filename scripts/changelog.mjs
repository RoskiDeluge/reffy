import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function compareVersions(left, right) {
  if (!STABLE_VERSION.test(left) || !STABLE_VERSION.test(right)) {
    throw new Error("Release versions must use stable X.Y.Z format without a v prefix");
  }
  const a = left.split(".").map(BigInt);
  const b = right.split(".").map(BigInt);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}

function validateDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Release date must be a valid YYYY-MM-DD UTC date");
  }
}

export function parseChangelog(content) {
  const text = content.replaceAll("\r\n", "\n");
  const headings = [...text.matchAll(/^## (.+)$/gm)];
  if (!headings.length || headings[0][1] !== "[Unreleased]") {
    throw new Error("CHANGELOG.md must start its sections with ## [Unreleased]");
  }
  const sections = headings.map((heading, index) => {
    const body = text.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? text.length).trim();
    if (index === 0) return { version: "Unreleased", body };
    const match = /^\[([^\]]+)\] - (\d{4}-\d{2}-\d{2})$/.exec(heading[1]);
    if (!match) throw new Error(`Invalid changelog heading: ${heading[0]}`);
    compareVersions(match[1], match[1]);
    validateDate(match[2]);
    return { version: match[1], date: match[2], body };
  });
  for (let i = 2; i < sections.length; i += 1) {
    if (compareVersions(sections[i - 1].version, sections[i].version) <= 0) {
      throw new Error("Changelog release versions must be unique and newest first");
    }
  }
  return { preamble: text.slice(0, headings[0].index).trimEnd(), sections };
}

function hasNotes(body) {
  return /^\s*[-*] \S/m.test(body);
}

export function checkChangelog(content, version) {
  compareVersions(version, version);
  const parsed = parseChangelog(content);
  if (parsed.sections[1]?.version !== version) {
    throw new Error(`Newest changelog release must match package.json version ${version}`);
  }
  for (const section of parsed.sections.slice(1)) {
    if (!hasNotes(section.body)) throw new Error(`Release ${section.version} has no changelog notes`);
  }
  return parsed;
}

export function releaseNotes(content, packageVersion, tag = `v${packageVersion}`) {
  const parsed = checkChangelog(content, packageVersion);
  if (tag !== `v${packageVersion}`) throw new Error(`Tag ${tag} does not match package.json version v${packageVersion}`);
  return `${parsed.sections[1].body}\n`;
}

/** Pure preflight: invalid input never changes either release file. */
export function prepareRelease(packageContent, changelogContent, nextVersion, date = new Date().toISOString().slice(0, 10)) {
  const pkg = JSON.parse(packageContent);
  const parsed = checkChangelog(changelogContent, pkg.version);
  validateDate(date);
  const comparison = compareVersions(nextVersion, pkg.version);
  if (comparison === 0) return { changed: false, packageContent, changelogContent };
  if (comparison < 0) throw new Error(`Release version must be newer than ${pkg.version}`);
  if (parsed.sections.some(section => section.version === nextVersion)) throw new Error(`Release ${nextVersion} already exists`);
  if (!hasNotes(parsed.sections[0].body)) throw new Error("Add user-facing notes under Unreleased before preparing a release");
  const history = parsed.sections.slice(1).map(section => `## [${section.version}] - ${section.date}\n\n${section.body}`).join("\n\n");
  const changelog = `${parsed.preamble}\n\n## [Unreleased]\n\n## [${nextVersion}] - ${date}\n\n${parsed.sections[0].body}\n\n${history}\n`;
  return {
    changed: true,
    packageContent: `${JSON.stringify({ ...pkg, version: nextVersion }, null, 2)}\n`,
    changelogContent: changelog,
  };
}

async function main() {
  const [command, argument, ...extra] = process.argv.slice(2);
  if (extra.length || !["check", "notes", "prepare"].includes(command) || (command === "check" && argument)) {
    throw new Error("Usage: node scripts/changelog.mjs check | notes [vX.Y.Z] | prepare X.Y.Z");
  }
  const packageContent = await readFile("package.json", "utf8");
  const changelogContent = await readFile("CHANGELOG.md", "utf8");
  const { version } = JSON.parse(packageContent);
  if (command === "check") {
    checkChangelog(changelogContent, version);
    console.log(`Changelog valid for ${version}`);
  } else if (command === "notes") {
    process.stdout.write(releaseNotes(changelogContent, version, argument));
  } else {
    if (!argument) throw new Error("prepare requires the next stable X.Y.Z version");
    const prepared = prepareRelease(packageContent, changelogContent, argument);
    if (prepared.changed) {
      await writeFile("CHANGELOG.md", prepared.changelogContent);
      await writeFile("package.json", prepared.packageContent);
    }
    console.log(prepared.changed ? `Prepared release ${argument}` : `Release ${argument} already prepared; no changes`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
