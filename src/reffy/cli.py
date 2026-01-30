from __future__ import annotations

import argparse
from pathlib import Path


REFFY_BLOCK = """<!-- REFFY:START -->
# Reffy Instructions

These instructions are for AI assistants working in this project.

Always open `@/.references/` when the request:
- Mentions early-stage ideation, exploration, brainstorming, or raw notes
- Needs context before drafting specs or proposals
- Refers to "reffy", "references", "explore", or "context layer"

Use `.references/` to:
- Store and read exploratory artifacts (canonical source of truth)
- Sync to Linear via the local Reffy server if configured

Keep this managed block so `reffy init` can refresh the instructions.

<!-- REFFY:END -->
"""

REFFY_START = "<!-- REFFY:START -->"
REFFY_END = "<!-- REFFY:END -->"
OPENSPEC_START = "<!-- OPENSPEC:START -->"


def _upsert_reffy_block(content: str) -> str:
    if REFFY_START in content and REFFY_END in content:
        prefix = content.split(REFFY_START)[0]
        suffix = content.split(REFFY_END, 1)[1]
        return f"{prefix}{REFFY_BLOCK}{suffix.lstrip()}"
    if OPENSPEC_START in content:
        before, after = content.split(OPENSPEC_START, 1)
        return f"{before.rstrip()}\n\n{REFFY_BLOCK}\n\n{OPENSPEC_START}{after}"
    return f"{REFFY_BLOCK}\n\n{content.lstrip()}" if content.strip() else f"{REFFY_BLOCK}\n"


def init_agents(repo_root: Path) -> Path:
    agents_path = repo_root / "AGENTS.md"
    if agents_path.exists():
        content = agents_path.read_text()
    else:
        content = ""
    updated = _upsert_reffy_block(content)
    agents_path.write_text(updated)
    return agents_path


def main() -> int:
    parser = argparse.ArgumentParser(prog="reffy", description="Reffy CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)
    init_parser = subparsers.add_parser("init", help="Insert Reffy block into AGENTS.md")
    init_parser.add_argument(
        "--repo",
        type=Path,
        default=Path.cwd(),
        help="Path to repo root (default: current working directory)",
    )
    args = parser.parse_args()

    if args.command == "init":
        path = init_agents(args.repo)
        print(f"Updated {path}")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
