# reffy-ts

TypeScript/Node port of the Python `reffy` app. This repo is separate so the Python project remains untouched.

## Install

```bash
npm install
```

## Develop

```bash
npm run dev
```

## Build + Run

```bash
npm run build
npm start
```

The server defaults to `http://127.0.0.1:8000`.

## API Endpoints

- `GET /health`
- `GET /references`
- `POST /references`
- `GET /references/:artifact_id`
- `PATCH /references/:artifact_id`
- `DELETE /references/:artifact_id`
- `GET /references/:artifact_id/download`
- `POST /references/reindex`
- `POST /sync/push`
- `POST /sync/pull`

## CLI

```bash
npm run build
node dist/cli.js init --repo .
```

Or install globally from this folder and use `reffy init`.

## Environment Variables

- `LINEAR_API_KEY`
- `LINEAR_OAUTH_TOKEN`
- `LINEAR_TEAM_ID`
- `LINEAR_PROJECT_ID`
- `LINEAR_PULL_CREATE=1`
- `LINEAR_PULL_LABEL=reffy`
- `LINEAR_PUSH_LABEL=reffy`
- `LINEAR_PULL_ON_START=1`
- `LINEAR_WATCH=1`
- `LINEAR_WATCH_PUSH=1`
- `LINEAR_WATCH_REINDEX=1`
- `LINEAR_WATCH_DEBOUNCE=1.0`
- `HOST=127.0.0.1`
- `PORT=8000`
