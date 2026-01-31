# reffy

Local-first references store with Linear sync (MVP scaffold).

## Quickstart (uv)

```bash
uv venv
source .venv/bin/activate
uv pip install -e .
uvicorn reffy.app:app --reload
```

Open:
- http://127.0.0.1:8000/health
- http://127.0.0.1:8000/references

## Notes
- The `.references/` folder is treated as the canonical store.
- This scaffold keeps the schema minimal; we can tighten it next.
- Linear sync endpoints are stubbed for now; they return a status payload.

## Linear sync (push + pull wired)

Endpoints:
- `POST /sync/push`
- `POST /sync/pull`

Environment variables (for future wiring):
- `LINEAR_API_KEY`
- `LINEAR_OAUTH_TOKEN`
- `LINEAR_TEAM_ID`
- `LINEAR_PROJECT_ID`
- `LINEAR_PULL_CREATE=1` (enable creating local artifacts for unmapped Linear issues)
- `LINEAR_PULL_LABEL=reffy` (required when pull-create is enabled; only import issues with this label)
- `LINEAR_PUSH_LABEL=reffy` (label new issues on push; set empty to disable)
- `LINEAR_PULL_ON_START=1` (auto-pull when the server starts)
- `LINEAR_WATCH=1` (enable local filesystem watcher)
- `LINEAR_WATCH_PUSH=1` (auto-push to Linear on changes)
- `LINEAR_WATCH_DEBOUNCE=1.0` (seconds; default 1.0)

Notes:
- Push creates/updates issues and stores mappings in `.references/links/linear.json`.
- Non-markdown artifacts are uploaded and attached to their Linear issue on push.
- Pull updates local artifacts for any mapped Linear issues.
- If local content diverged since the last pull, pull will create a conflict copy before overwriting.
- When `LINEAR_PULL_CREATE=1` is set, pull will scan recent issues (first 50) and create local artifacts for unmapped issues that have the `LINEAR_PULL_LABEL`.
- The app loads `.env` from the repo root on startup.
- The watcher runs only when `LINEAR_WATCH=1` is set.

## Manifest (v1, draft)

The manifest lives at `.references/manifest.json` and is intentionally small for MVP:

```json
{
  "version": 1,
  "created_at": "2026-01-27T00:00:00+00:00",
  "updated_at": "2026-01-27T00:00:00+00:00",
  "artifacts": [
    {
      "id": "uuid",
      "name": "Idea space",
      "filename": "uuid-idea-space.md",
      "kind": "note",
      "mime_type": "text/markdown",
      "size_bytes": 123,
      "tags": [],
      "created_at": "2026-01-27T00:00:00+00:00",
      "updated_at": "2026-01-27T00:00:00+00:00"
    }
  ],
  "conflicts": [
    {
      "artifact_id": "uuid",
      "source": "linear",
      "note": "Both local and Linear edits detected; created a merge copy.",
      "conflict_artifact_id": "uuid",
      "created_at": "2026-01-27T00:00:00+00:00"
    }
  ]
}
```

We can expand this with Linear linkage, provenance, and richer artifact types once the basics feel right.
