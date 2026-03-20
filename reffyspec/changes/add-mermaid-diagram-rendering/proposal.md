# Change: Add Mermaid Diagram Rendering Command

## Why
Reffy artifacts and OpenSpec proposals often benefit from visual diagrams, but today there is no first-party way to render Mermaid content for either rich docs (SVG) or terminal-first workflows (ASCII). A built-in rendering command enables consistent diagram output directly from the Reffy CLI.

## What Changes
- Add a new CLI command: `reffy diagram render [--input PATH|--stdin] [--format svg|ascii] [--output PATH]`.
- Support rendering Mermaid source to SVG (default) or ASCII/Unicode output for terminal usage.
- Add spec-aware generation mode so the command can use a feature's generated `spec.md` as the source of diagram elements and relationships.
- Add theme support for SVG rendering with built-in named themes and lightweight custom color overrides.
- Keep rendering behavior read-only with respect to `.references/manifest.json` and existing artifacts unless an explicit output path is provided.
- Document command usage and examples in `README.md`.

## Impact
- Affected specs: `diagram-rendering`
- Affected code: `src/cli.ts`, new diagram rendering module(s), dependency wiring for Mermaid rendering, `README.md`.

## Reffy References
- `beautiful-mermaid.md` - defines target rendering capabilities (SVG + ASCII), theming model, and terminal-friendly output goals.
