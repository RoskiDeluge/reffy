## 1. Implementation
- [x] 1.1 Add `diagram render` command routing in `src/cli.ts` with input/output and format flags.
- [x] 1.2 Integrate Mermaid rendering engine support for SVG output.
- [x] 1.3 Add ASCII/Unicode rendering support for terminal output mode.
- [x] 1.4 Implement spec-aware diagram generation from a feature's generated `spec.md` (requirements/scenarios to nodes/edges mapping).
- [x] 1.5 Implement SVG theming with named themes plus custom color overrides.
- [x] 1.6 Add robust error handling for unsupported diagram syntax, unsupported format/theme values, missing input, and malformed `spec.md` references.
- [x] 1.7 Update `README.md` with command docs and practical examples.

## 2. Verification
- [x] 2.1 Run `npm run build` and `npm run check`.
- [x] 2.2 Run `node dist/cli.js diagram render --format svg --stdin` with a valid Mermaid sample and verify SVG output.
- [x] 2.3 Run `node dist/cli.js diagram render --format ascii --stdin` with a valid Mermaid sample and verify terminal-safe output.
- [x] 2.4 Run `node dist/cli.js diagram render` against a generated feature `spec.md` and verify element/relationship mapping in output.
- [x] 2.5 Verify invalid Mermaid input or malformed `spec.md` input returns non-zero exit code with actionable error text.
