## ADDED Requirements

### Requirement: Diagram Render Command
The CLI SHALL provide a `diagram render` command that converts Mermaid source into renderable output.

#### Scenario: Render Mermaid to SVG
- **WHEN** a user runs `reffy diagram render --format svg` with valid Mermaid input
- **THEN** the CLI outputs SVG content
- **AND** the command exits successfully

#### Scenario: Render Mermaid to ASCII
- **WHEN** a user runs `reffy diagram render --format ascii` with valid Mermaid input
- **THEN** the CLI outputs terminal-safe diagram text
- **AND** the command exits successfully

### Requirement: Input and Output Handling
The `diagram render` command MUST support stdin-based input and optional file output.

#### Scenario: Read Mermaid from stdin
- **WHEN** a user runs `reffy diagram render --stdin` and provides Mermaid text via standard input
- **THEN** the command reads the full input payload and renders it

#### Scenario: Write rendered output to file
- **WHEN** a user runs `reffy diagram render --output <path>` with valid Mermaid input
- **THEN** rendered content is written to the specified path
- **AND** stdout output is suppressed or reduced to non-content status text

### Requirement: Spec-Aware Diagram Reference
The `diagram render` command SHALL support using a generated feature `spec.md` document as a reference for diagram elements and their relationships.

#### Scenario: Generate diagram from feature spec
- **WHEN** a user runs `reffy diagram render` with a generated feature `spec.md` as input
- **THEN** the command derives diagram nodes and edges from requirements and scenario relationships in that `spec.md`
- **AND** the command returns renderable output in the selected format

### Requirement: Theming for SVG Output
The system SHALL support theme selection and color customization for SVG rendering.

#### Scenario: Use built-in theme
- **WHEN** a user runs `reffy diagram render --format svg --theme <name>` with a supported theme name
- **THEN** the rendered SVG reflects the selected theme palette

#### Scenario: Override theme colors
- **WHEN** a user provides one or more explicit color overrides (for example background or foreground)
- **THEN** the rendered SVG applies provided overrides while preserving valid output

### Requirement: Validation and Failure Behavior
The `diagram render` command MUST fail with actionable diagnostics on invalid input or unsupported options.

#### Scenario: Invalid Mermaid source
- **WHEN** provided Mermaid input cannot be parsed by the renderer
- **THEN** the command exits non-zero
- **AND** stderr includes an error message that identifies rendering failure

#### Scenario: Unsupported format flag
- **WHEN** a user passes an unsupported `--format` value
- **THEN** the command exits non-zero
- **AND** stderr includes valid format options
