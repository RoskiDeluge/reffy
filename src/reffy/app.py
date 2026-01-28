from __future__ import annotations

from contextlib import asynccontextmanager
import os
from pathlib import Path
from threading import Thread

from dotenv import load_dotenv

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse, Response
from starlette.routing import Route

from reffy.linear import LinearClient, LinearSync
from reffy.storage import ReferencesStore
from reffy.watcher import ReferencesWatcher


REPO_ROOT = Path.cwd()
load_dotenv(REPO_ROOT / ".env")
STORE = ReferencesStore(REPO_ROOT)
LINEAR = LinearClient.from_env()
LINEAR_SYNC = LinearSync(REPO_ROOT, STORE, LINEAR)
WATCHER: ReferencesWatcher | None = None


def _watcher_callback() -> None:
    if os.getenv("LINEAR_WATCH_PUSH") != "1":
        return
    try:
        LINEAR_SYNC.push()
    except Exception:
        pass


@asynccontextmanager
async def lifespan(_: Starlette):
    global WATCHER
    if ReferencesWatcher.enabled():
        WATCHER = ReferencesWatcher(STORE.refs_dir, lambda: Thread(target=_watcher_callback, daemon=True).start())
        WATCHER.start()
    yield
    if WATCHER:
        WATCHER.stop()
        WATCHER = None


async def health(_: Request) -> JSONResponse:
    return JSONResponse({"status": "ok"})


async def list_references(request: Request) -> JSONResponse:
    items = STORE.list_artifacts()
    kind = request.query_params.get("kind")
    tag = request.query_params.get("tag")
    if kind:
        items = [item for item in items if item.get("kind") == kind]
    if tag:
        items = [item for item in items if tag in (item.get("tags") or [])]
    return JSONResponse({"items": items})


async def create_reference(request: Request) -> JSONResponse:
    payload = await request.json()
    name = str(payload.get("name") or "untitled")
    content = payload.get("content")
    kind = payload.get("kind")
    mime_type = payload.get("mime_type")
    tags = payload.get("tags")
    if tags is not None and not isinstance(tags, list):
        return JSONResponse({"error": "tags_must_be_list"}, status_code=400)
    artifact = STORE.create_artifact(
        name=name,
        content=content,
        kind=kind,
        mime_type=mime_type,
        tags=tags,
    )
    return JSONResponse(artifact, status_code=201)


async def get_reference(request: Request) -> JSONResponse | Response:
    artifact_id = request.path_params["artifact_id"]
    artifact = STORE.get_artifact(artifact_id)
    if not artifact:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return JSONResponse(artifact)


async def download_reference(request: Request) -> Response:
    artifact_id = request.path_params["artifact_id"]
    artifact = STORE.get_artifact(artifact_id)
    if not artifact:
        return JSONResponse({"error": "not_found"}, status_code=404)
    path = STORE.get_artifact_path(artifact)
    if not path.exists():
        return JSONResponse({"error": "missing_file"}, status_code=404)
    return FileResponse(path, media_type=artifact.get("mime_type"))


async def update_reference(request: Request) -> JSONResponse | Response:
    artifact_id = request.path_params["artifact_id"]
    payload = await request.json()
    tags = payload.get("tags")
    if tags is not None and not isinstance(tags, list):
        return JSONResponse({"error": "tags_must_be_list"}, status_code=400)
    updated = STORE.update_artifact(
        artifact_id,
        name=payload.get("name"),
        content=payload.get("content"),
        kind=payload.get("kind"),
        mime_type=payload.get("mime_type"),
        tags=tags,
    )
    if not updated:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return JSONResponse(updated)


async def delete_reference(request: Request) -> Response:
    artifact_id = request.path_params["artifact_id"]
    deleted = STORE.delete_artifact(artifact_id)
    if not deleted:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return Response(status_code=204)


async def sync_push(_: Request) -> JSONResponse:
    response = LINEAR_SYNC.push()
    response["configured"] = LINEAR.is_configured()
    status_code = 400 if response.get("status") == "error" else 200
    return JSONResponse(response, status_code=status_code)


async def sync_pull(_: Request) -> JSONResponse:
    response = LINEAR_SYNC.pull()
    response["configured"] = LINEAR.is_configured()
    status_code = 400 if response.get("status") == "error" else 200
    return JSONResponse(response, status_code=status_code)


routes = [
    Route("/health", health, methods=["GET"]),
    Route("/references", list_references, methods=["GET"]),
    Route("/references", create_reference, methods=["POST"]),
    Route("/references/{artifact_id}", get_reference, methods=["GET"]),
    Route("/references/{artifact_id}", update_reference, methods=["PATCH"]),
    Route("/references/{artifact_id}", delete_reference, methods=["DELETE"]),
    Route("/references/{artifact_id}/download", download_reference, methods=["GET"]),
    Route("/sync/push", sync_push, methods=["POST"]),
    Route("/sync/pull", sync_pull, methods=["POST"]),
]

app = Starlette(routes=routes, lifespan=lifespan)
