# Change: Refactor ReffySpec into a Reffy Planning Subsystem

## Why
Reffy currently treats ideation artifacts as an upstream helper layer, while formal planning remains conceptually separate. The v1 refactor direction is to make artifact-backed ideation the canonical planning input and add a lean planning subsystem inside Reffy that can generate OpenSpec-style planning outputs from that context.

The current repository also has a terminology and layout mismatch: project conventions describe `.reffy/`, but this repo still contains `.references/`. Without an explicit plan, the refactor risks mixing branding, migration, and implementation concerns into one oversized change.
This repo also contains a vendored OpenSpec fork at `.vendor/ReffySpec`, which is useful as a source of reference behavior and structure but should not be treated as the first-party implementation target for v1.

## What Changes
- Adopt `.reffy/` as the canonical workspace and manifest location for v1.
- Define ReffySpec as a planning subsystem inside Reffy rather than a separate renamed product.
- Treat `.vendor/ReffySpec` as reference material for extracting useful planning patterns, not as the runtime home of the new subsystem.
- Add a planning workflow that derives proposal/spec/task scaffolding from indexed Reffy artifacts.
- Define the minimum v1 generated outputs as:
  - OpenSpec-style `proposal.md`
  - OpenSpec-style `tasks.md`
  - spec delta files
  - required boilerplate for `AGENTS.md` and manifest-backed planning references
- Introduce migration rules from legacy `.references/` layouts to the canonical `.reffy/` contract.
- Simplify the future CLI surface around stable command verbs rather than harness-specific slash commands.

## Impact
- Affected specs: `reffy-workspace`, `artifact-planning`
- Affected code: `src/cli.ts`, `src/storage.ts`, manifest handling, init/bootstrap flows, planning generation modules, `README.md`, managed instruction templates, and documentation that explains the role of `.vendor/ReffySpec`.

## Reffy References
- `refactor-idea.md` - establishes the direction to make ideation artifacts the primary planning context and to lean down the inherited OpenSpec scope.
- `reffyspec-refactor-plan.md` - defines the phased execution strategy, migration concerns, and v1 boundaries for the refactor.
- `decision-note-v1.md` - resolves the key product decisions: canonical `.reffy/`, subsystem positioning, and minimum v1 planning outputs.
