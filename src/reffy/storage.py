from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
import mimetypes
from typing import Any
from uuid import uuid4

MANIFEST_VERSION = 1


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Artifact:
    id: str
    name: str
    filename: str
    kind: str
    mime_type: str
    size_bytes: int
    tags: list[str]
    created_at: str
    updated_at: str


class ReferencesStore:
    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root
        self.refs_dir = repo_root / ".references"
        self.artifacts_dir = self.refs_dir / "artifacts"
        self.manifest_path = self.refs_dir / "manifest.json"
        self._ensure_structure()

    def _ensure_structure(self) -> None:
        self.refs_dir.mkdir(parents=True, exist_ok=True)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        if not self.manifest_path.exists():
            self._write_manifest(self._empty_manifest())

    def _empty_manifest(self) -> dict[str, Any]:
        now = _utc_now()
        return {
            "version": MANIFEST_VERSION,
            "created_at": now,
            "updated_at": now,
            "artifacts": [],
            "conflicts": [],
        }

    def _read_manifest(self) -> dict[str, Any]:
        try:
            data = json.loads(self.manifest_path.read_text())
        except FileNotFoundError:
            data = self._empty_manifest()
        if isinstance(data, list):
            # Backward-compat: older manifest stored only a list of artifacts.
            data = {
                "version": 0,
                "created_at": _utc_now(),
                "updated_at": _utc_now(),
                "artifacts": data,
            }
        if not isinstance(data, dict):
            return self._empty_manifest()
        data.setdefault("version", MANIFEST_VERSION)
        data.setdefault("created_at", _utc_now())
        data.setdefault("updated_at", _utc_now())
        data.setdefault("artifacts", [])
        data.setdefault("conflicts", [])
        return data

    def _write_manifest(self, manifest: dict[str, Any]) -> None:
        self.manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True))

    def list_artifacts(self) -> list[dict[str, Any]]:
        return self._read_manifest().get("artifacts", [])

    def get_manifest(self) -> dict[str, Any]:
        return self._read_manifest()

    def get_artifact(self, artifact_id: str) -> dict[str, Any] | None:
        for item in self._read_manifest().get("artifacts", []):
            if item.get("id") == artifact_id:
                return item
        return None

    def get_artifact_path(self, artifact: dict[str, Any]) -> Path:
        return self.artifacts_dir / artifact["filename"]

    def _slugify(self, name: str) -> str:
        cleaned = "".join(ch if ch.isalnum() or ch in ("-", "_", " ") else "" for ch in name)
        cleaned = "-".join(part for part in cleaned.strip().split() if part)
        return cleaned.lower() or "untitled"

    def _unique_filename(self, base: str, ext: str = ".md") -> str:
        candidate = f"{base}{ext}"
        if not (self.artifacts_dir / candidate).exists():
            return candidate
        counter = 2
        while True:
            candidate = f"{base}-{counter}{ext}"
            if not (self.artifacts_dir / candidate).exists():
                return candidate
            counter += 1

    def create_artifact(
        self,
        name: str,
        content: str | None,
        *,
        kind: str | None = None,
        mime_type: str | None = None,
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        artifact_id = str(uuid4())
        safe_name = self._slugify(name)
        filename = self._unique_filename(safe_name, ".md")
        now = _utc_now()
        path = self.artifacts_dir / filename
        if content is not None:
            path.write_text(content)
        size_bytes = path.stat().st_size if path.exists() else 0
        artifact = Artifact(
            id=artifact_id,
            name=name,
            filename=filename,
            kind=kind or "note",
            mime_type=mime_type or "text/markdown",
            size_bytes=size_bytes,
            tags=tags or [],
            created_at=now,
            updated_at=now,
        )
        manifest = self._read_manifest()
        manifest["updated_at"] = _utc_now()
        manifest["artifacts"].append(asdict(artifact))
        self._write_manifest(manifest)
        return asdict(artifact)

    def _infer_kind(self, path: Path) -> tuple[str, str]:
        suffix = path.suffix.lower()
        if suffix == ".excalidraw":
            return "diagram", "application/json"
        if suffix in {".png", ".jpg", ".jpeg"}:
            mime = "image/png" if suffix == ".png" else "image/jpeg"
            return "image", mime
        if suffix in {".html", ".htm"}:
            return "html", "text/html"
        if suffix == ".pdf":
            return "pdf", "application/pdf"
        if suffix == ".doc":
            return "doc", "application/msword"
        if suffix == ".docx":
            return "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if suffix == ".json":
            return "json", "application/json"
        if suffix == ".md":
            return "note", "text/markdown"
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        return "file", mime

    def reindex_artifacts(self) -> dict[str, Any]:
        manifest = self._read_manifest()
        artifacts = manifest.get("artifacts", [])
        known_filenames = {item.get("filename") for item in artifacts if item.get("filename")}
        added = 0
        for path in self.artifacts_dir.iterdir():
            if path.is_dir():
                continue
            if path.name in known_filenames:
                continue
            kind, mime_type = self._infer_kind(path)
            now = _utc_now()
            artifact = Artifact(
                id=str(uuid4()),
                name=path.stem.replace("-", " ").strip() or "untitled",
                filename=path.name,
                kind=kind,
                mime_type=mime_type,
                size_bytes=path.stat().st_size,
                tags=[],
                created_at=now,
                updated_at=now,
            )
            artifacts.append(asdict(artifact))
            added += 1
        if added:
            manifest["artifacts"] = artifacts
            manifest["updated_at"] = _utc_now()
            self._write_manifest(manifest)
        return {"added": added, "total": len(artifacts)}

    def update_artifact(
        self,
        artifact_id: str,
        *,
        name: str | None = None,
        content: str | None = None,
        kind: str | None = None,
        mime_type: str | None = None,
        tags: list[str] | None = None,
    ) -> dict[str, Any] | None:
        manifest = self._read_manifest()
        items = manifest.get("artifacts", [])
        for idx, item in enumerate(items):
            if item.get("id") != artifact_id:
                continue
            if name is not None:
                item["name"] = name
            if kind is not None:
                item["kind"] = kind
            if mime_type is not None:
                item["mime_type"] = mime_type
            if tags is not None:
                item["tags"] = tags
            if content is not None:
                path = self.get_artifact_path(item)
                path.write_text(content)
                item["size_bytes"] = path.stat().st_size
            item["updated_at"] = _utc_now()
            items[idx] = item
            manifest["updated_at"] = _utc_now()
            self._write_manifest(manifest)
            return item
        return None

    def delete_artifact(self, artifact_id: str) -> bool:
        manifest = self._read_manifest()
        items = manifest.get("artifacts", [])
        remaining = []
        removed = None
        for item in items:
            if item.get("id") == artifact_id:
                removed = item
            else:
                remaining.append(item)
        if not removed:
            return False
        path = self.get_artifact_path(removed)
        if path.exists():
            path.unlink()
        manifest["artifacts"] = remaining
        manifest["updated_at"] = _utc_now()
        self._write_manifest(manifest)
        return True

    def record_conflict(
        self,
        *,
        artifact_id: str,
        source: str,
        note: str,
        conflict_artifact_id: str | None = None,
    ) -> dict[str, Any]:
        manifest = self._read_manifest()
        entry = {
            "artifact_id": artifact_id,
            "source": source,
            "note": note,
            "conflict_artifact_id": conflict_artifact_id,
            "created_at": _utc_now(),
        }
        manifest["updated_at"] = _utc_now()
        manifest["conflicts"].append(entry)
        self._write_manifest(manifest)
        return entry

    def create_conflict_copy(
        self,
        *,
        artifact_id: str,
        source: str,
        note: str,
    ) -> dict[str, Any] | None:
        original = self.get_artifact(artifact_id)
        if not original:
            return None
        original_path = self.get_artifact_path(original)
        if not original_path.exists():
            return None
        content = original_path.read_text()
        conflict_name = f"{original['name']} (conflict)"
        conflict_artifact = self.create_artifact(
            name=conflict_name,
            content=content,
            kind=original.get("kind") or "note",
            mime_type=original.get("mime_type") or "text/markdown",
            tags=(original.get("tags") or []) + ["conflict"],
        )
        self.record_conflict(
            artifact_id=artifact_id,
            source=source,
            note=note,
            conflict_artifact_id=conflict_artifact["id"],
        )
        return conflict_artifact
