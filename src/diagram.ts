import { promises as fs } from "node:fs";
import path from "node:path";

import { THEMES, renderMermaid, renderMermaidAscii } from "beautiful-mermaid";

export type DiagramFormat = "svg" | "ascii";

export interface DiagramRenderRequest {
  repoRoot: string;
  inputPath?: string;
  stdin?: boolean;
  format: DiagramFormat;
  outputPath?: string;
  theme?: string;
  bg?: string;
  fg?: string;
  line?: string;
  accent?: string;
  muted?: string;
  surface?: string;
  border?: string;
  font?: string;
}

function isLikelyOpenSpecDocument(inputPath: string | undefined, content: string): boolean {
  if (inputPath && path.basename(inputPath).toLowerCase() === "spec.md") return true;
  return /^### Requirement:\s+/m.test(content) && /^#### Scenario:\s+/m.test(content);
}

function toNodeId(prefix: string, index: number): string {
  return `${prefix}${String(index + 1)}`;
}

function sanitizeLabel(value: string): string {
  return value.replace(/"/g, "'").replace(/\s+/g, " ").trim();
}

function convertSpecToMermaid(specText: string): string {
  const requirementRegex = /^### Requirement:\s*(.+)$/gm;
  const scenarioRegex = /^#### Scenario:\s*(.+)$/gm;

  const requirements = Array.from(specText.matchAll(requirementRegex)).map((match) => ({
    title: sanitizeLabel(match[1] ?? ""),
    index: match.index ?? 0,
  }));

  if (requirements.length === 0) {
    throw new Error("Unable to derive diagram from spec.md: no requirements found.");
  }

  const scenarios = Array.from(specText.matchAll(scenarioRegex)).map((match) => ({
    title: sanitizeLabel(match[1] ?? ""),
    index: match.index ?? 0,
  }));

  const lines: string[] = ["graph TD"];
  let scenarioCursor = 0;

  for (let i = 0; i < requirements.length; i += 1) {
    const requirement = requirements[i];
    const nextRequirementIndex = i + 1 < requirements.length ? requirements[i + 1]?.index ?? specText.length : specText.length;
    const requirementId = toNodeId("R", i);
    lines.push(`  ${requirementId}["Requirement: ${requirement.title}"]`);

    while (scenarioCursor < scenarios.length) {
      const scenario = scenarios[scenarioCursor];
      if (scenario.index < requirement.index || scenario.index >= nextRequirementIndex) {
        break;
      }
      const scenarioId = toNodeId("S", scenarioCursor);
      lines.push(`  ${scenarioId}["Scenario: ${scenario.title}"]`);
      lines.push(`  ${requirementId} --> ${scenarioId}`);
      scenarioCursor += 1;
    }
  }

  return lines.join("\n");
}

async function readStdinFully(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function loadSource(request: DiagramRenderRequest): Promise<{ sourceText: string; sourceKind: "mermaid" | "spec" }> {
  if (request.stdin && request.inputPath) {
    throw new Error("Provide either --stdin or --input, not both.");
  }
  if (!request.stdin && !request.inputPath) {
    throw new Error("Diagram input required: pass --stdin or --input <path>.");
  }

  const raw = request.stdin
    ? await readStdinFully()
    : await fs.readFile(path.isAbsolute(request.inputPath ?? "") ? (request.inputPath as string) : path.join(request.repoRoot, request.inputPath as string), "utf8");

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("Diagram input is empty.");
  }

  if (isLikelyOpenSpecDocument(request.inputPath, raw)) {
    return { sourceText: convertSpecToMermaid(raw), sourceKind: "spec" };
  }
  return { sourceText: raw, sourceKind: "mermaid" };
}

function resolveSvgTheme(request: DiagramRenderRequest): Record<string, string | number | boolean> {
  const options: Record<string, string | number | boolean> = {};
  if (request.theme) {
    const theme = THEMES[request.theme];
    if (!theme) {
      const validThemes = Object.keys(THEMES).sort().join(", ");
      throw new Error(`Unsupported theme: ${request.theme}. Valid themes: ${validThemes}`);
    }
    Object.assign(options, theme);
  }

  const overrides: Array<keyof DiagramRenderRequest> = ["bg", "fg", "line", "accent", "muted", "surface", "border", "font"];
  for (const key of overrides) {
    const value = request[key];
    if (typeof value === "string" && value.length > 0) {
      options[key] = value;
    }
  }

  return options;
}

export async function renderDiagram(request: DiagramRenderRequest): Promise<{ content: string; source_kind: "mermaid" | "spec" }> {
  const { sourceText, sourceKind } = await loadSource(request);

  let content = "";
  if (request.format === "ascii") {
    content = renderMermaidAscii(sourceText);
  } else {
    const svgOptions = resolveSvgTheme(request);
    content = await renderMermaid(sourceText, svgOptions);
  }

  if (request.outputPath) {
    const outPath = path.isAbsolute(request.outputPath) ? request.outputPath : path.join(request.repoRoot, request.outputPath);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, content, "utf8");
  }

  return { content, source_kind: sourceKind };
}
