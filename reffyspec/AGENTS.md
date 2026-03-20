# ReffySpec Instructions

These instructions are for AI assistants working in this project.

## TL;DR Checklist

- Read [project.md](/Users/robertodelgado/dev/reffy/reffyspec/project.md) before making planning or spec changes.
- Inspect current truth in `reffyspec/specs/` before editing behavior.
- Inspect active changes in `reffyspec/changes/` before drafting or implementing new work.
- Use Reffy-native commands for the normal planning lifecycle.

## ReffySpec Workflow

1. Review `reffyspec/project.md` for repo conventions.
2. Read relevant specs in `reffyspec/specs/<capability>/spec.md`.
3. Read relevant active changes in `reffyspec/changes/<change-id>/`.
4. Draft or update `proposal.md`, `tasks.md`, optional `design.md`, and delta specs under `reffyspec/changes/<change-id>/`.
5. Use Reffy-native commands for routine workflow:
   - `reffy plan create`
   - `reffy plan validate`
   - `reffy plan list`
   - `reffy plan show`
   - `reffy plan archive`
   - `reffy spec list`
   - `reffy spec show`

## Directory Model

- `reffyspec/changes/` contains active proposed changes.
- `reffyspec/changes/archive/` contains archived historical changes.
- `reffyspec/specs/` contains current truth for each capability.

## Proposal Rules

- Use a unique verb-led `change-id` in kebab-case.
- Include `proposal.md`, `tasks.md`, optional `design.md`, and delta specs per affected capability.
- Delta specs must use `## ADDED|MODIFIED|REMOVED|RENAMED Requirements`.
- Each requirement must include at least one `#### Scenario:`.

## Relationship To Reffy

- Reffy owns the runtime and artifact workflow.
- ReffySpec is the canonical planning/spec surface.
- Reffy artifacts in `.reffy/` should inform proposal and design content without duplicating the full planning files.
