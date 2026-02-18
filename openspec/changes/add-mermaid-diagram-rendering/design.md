## Context
Reffy currently provides references lifecycle commands (`init`, `bootstrap`, `reindex`, `validate`, `doctor`, `summarize`) but no diagram rendering capability. The target behavior from the Reffy artifact is a fast, themeable Mermaid renderer that supports both SVG and ASCII outputs.

## Goals / Non-Goals
- Goals:
  - Add a CLI-native Mermaid rendering workflow for SVG and ASCII outputs.
  - Support deriving diagram structure from a generated feature `spec.md` to capture requirement/scenario relationships.
  - Keep output predictable for both human and automation usage.
  - Preserve existing read-only behavior for repository metadata files.
- Non-Goals:
  - Building a full interactive diagram editor.
  - Supporting every Mermaid extension on day one beyond the renderer's supported subset.
  - Mutating artifacts/manifest automatically during render.

## Decisions
- Decision: Introduce `reffy diagram render` as a new command family.
  - Rationale: Keeps rendering concerns isolated from summarize/validate workflows.
- Decision: Default output is stdout; file output requires `--output`.
  - Rationale: Supports CLI pipes and avoids accidental file writes.
- Decision: Theme model includes named presets and direct color overrides.
  - Rationale: Matches artifact direction while keeping flags straightforward.
- Decision: Include a spec-aware parsing path for generated feature `spec.md`.
  - Rationale: Keeps diagram structure aligned with formal OpenSpec requirements and scenario relationships.

## Risks / Trade-offs
- Renderer support may vary by Mermaid diagram type and complexity.
  - Mitigation: Return clear unsupported-feature errors and document support boundaries.
- External rendering dependency adds maintenance surface.
  - Mitigation: Pin compatible versions and include smoke checks in verification steps.

## Migration Plan
1. Add command scaffolding and parsing.
2. Add rendering module and dependency integration.
3. Add output and error behavior tests/smoke checks.
4. Update README usage guidance.

## Open Questions
- Should default ASCII output use Unicode box drawing or pure ASCII fallback?
- Should theme presets be shipped as static constants or delegated entirely to the rendering dependency?
