from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from reffy.storage import ReferencesStore


@dataclass
class LinearConfig:
    api_key: str | None
    oauth_token: str | None
    team_id: str | None
    project_id: str | None
    pull_create: bool
    pull_label: str | None
    push_label: str | None

    @classmethod
    def from_env(cls) -> "LinearConfig":
        push_label_env = os.getenv("LINEAR_PUSH_LABEL")
        if push_label_env is None:
            push_label = "reffy"
        else:
            push_label = push_label_env.strip() or None
        return cls(
            api_key=os.getenv("LINEAR_API_KEY"),
            oauth_token=os.getenv("LINEAR_OAUTH_TOKEN"),
            team_id=os.getenv("LINEAR_TEAM_ID"),
            project_id=os.getenv("LINEAR_PROJECT_ID"),
            pull_create=os.getenv("LINEAR_PULL_CREATE") == "1",
            pull_label=os.getenv("LINEAR_PULL_LABEL"),
            push_label=push_label,
        )


class LinearClient:
    def __init__(self, config: LinearConfig) -> None:
        self.config = config
        self.base_url = "https://api.linear.app/graphql"
        self._label_cache: dict[tuple[str, str], str | None] = {}

    @classmethod
    def from_env(cls) -> "LinearClient":
        return cls(LinearConfig.from_env())

    def is_configured(self) -> bool:
        return bool(self.config.api_key or self.config.oauth_token)

    def _headers(self) -> dict[str, str]:
        if self.config.oauth_token:
            return {"Authorization": f"Bearer {self.config.oauth_token}"}
        if self.config.api_key:
            return {"Authorization": self.config.api_key}
        return {}

    def _post(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        response = httpx.post(
            self.base_url,
            json={"query": query, "variables": variables or {}},
            headers=self._headers(),
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        if "errors" in payload:
            raise RuntimeError(payload["errors"])
        return payload.get("data", {})

    def get_first_team_id(self) -> str | None:
        data = self._post("query { teams { nodes { id } } }")
        nodes = data.get("teams", {}).get("nodes", [])
        if not nodes:
            return None
        return nodes[0].get("id")

    def get_label_id(self, *, team_id: str, name: str) -> str | None:
        cache_key = (team_id, name)
        if cache_key in self._label_cache:
            return self._label_cache[cache_key]
        query = "query TeamLabels($id: String!) { team(id: $id) { labels { nodes { id name } } } }"
        data = self._post(query, {"id": team_id})
        labels = data.get("team", {}).get("labels", {}).get("nodes", [])
        label_id = None
        for label in labels:
            if label.get("name") == name:
                label_id = label.get("id")
                break
        self._label_cache[cache_key] = label_id
        return label_id

    def create_issue(
        self,
        *,
        title: str,
        description: str,
        team_id: str,
        project_id: str | None,
        label_ids: list[str] | None = None,
    ) -> dict[str, str]:
        query = (
            "mutation IssueCreate($input: IssueCreateInput!) { "
            "issueCreate(input: $input) { success issue { id identifier } } }"
        )
        input_payload: dict[str, Any] = {
            "title": title,
            "teamId": team_id,
            "description": description,
        }
        if project_id:
            input_payload["projectId"] = project_id
        if label_ids:
            input_payload["labelIds"] = label_ids
        data = self._post(query, {"input": input_payload})
        issue = data.get("issueCreate", {}).get("issue")
        if not issue or not issue.get("id") or not issue.get("identifier"):
            raise RuntimeError("Linear issueCreate failed")
        return {"id": issue["id"], "identifier": issue["identifier"]}

    def file_upload(self, *, content_type: str, filename: str, size: int) -> dict[str, Any]:
        query = (
            "mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) { "
            "fileUpload(contentType: $contentType, filename: $filename, size: $size) { "
            "success uploadFile { uploadUrl assetUrl headers { key value } } } }"
        )
        data = self._post(query, {"contentType": content_type, "filename": filename, "size": size})
        payload = data.get("fileUpload")
        upload_file = payload.get("uploadFile") if payload else None
        if not payload or not payload.get("success") or not upload_file:
            raise RuntimeError("Linear fileUpload failed")
        return upload_file

    def create_attachment(self, *, issue_id: str, title: str, url: str) -> str:
        query = (
            "mutation AttachmentCreate($input: AttachmentCreateInput!) { "
            "attachmentCreate(input: $input) { success attachment { id } } }"
        )
        data = self._post(query, {"input": {"issueId": issue_id, "title": title, "url": url}})
        attachment = data.get("attachmentCreate", {}).get("attachment")
        if not attachment or not attachment.get("id"):
            raise RuntimeError("Linear attachmentCreate failed")
        return attachment["id"]

    def update_issue(self, *, issue_id: str, title: str, description: str) -> dict[str, str]:
        query = (
            "mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) { "
            "issueUpdate(id: $id, input: $input) { success issue { id identifier } } }"
        )
        data = self._post(query, {"id": issue_id, "input": {"title": title, "description": description}})
        issue = data.get("issueUpdate", {}).get("issue")
        if not issue or not issue.get("id") or not issue.get("identifier"):
            raise RuntimeError("Linear issueUpdate failed")
        return {"id": issue["id"], "identifier": issue["identifier"]}

    def get_issue(self, *, issue_id: str) -> dict[str, Any]:
        query = (
            "query Issue($id: String!) { "
            "issue(id: $id) { "
            "id identifier title description team { id name } project { id name } "
            "} }"
        )
        data = self._post(query, {"id": issue_id})
        issue = data.get("issue")
        if not issue or not issue.get("id"):
            raise RuntimeError("Linear issue not found")
        return issue

    def list_issues(self, *, first: int = 50) -> list[dict[str, Any]]:
        query = (
            "query Issues($first: Int!) { "
            "issues(first: $first) { nodes { "
            "id identifier title description team { id name } project { id name } "
            "labels { nodes { name } } "
            "} } }"
        )
        data = self._post(query, {"first": first})
        return data.get("issues", {}).get("nodes", []) or []


class LinearSync:
    def __init__(self, repo_root: Path, store: ReferencesStore, client: LinearClient) -> None:
        self.repo_root = repo_root
        self.store = store
        self.client = client
        self.links_dir = repo_root / ".references" / "links"
        self.mapping_path = self.links_dir / "linear.json"

    def _read_mapping(self) -> dict[str, Any]:
        if not self.mapping_path.exists():
            return {"artifacts": {}}
        try:
            return json.loads(self.mapping_path.read_text())
        except json.JSONDecodeError:
            return {"artifacts": {}}

    def _write_mapping(self, data: dict[str, Any]) -> None:
        self.links_dir.mkdir(parents=True, exist_ok=True)
        self.mapping_path.write_text(json.dumps(data, indent=2, sort_keys=True))

    def _artifact_description(self, artifact: dict[str, Any]) -> str:
        path = self.store.get_artifact_path(artifact)
        if not path.exists():
            return ""
        mime_type = artifact.get("mime_type") or "text/plain"
        if not mime_type.startswith("text/"):
            return f"Binary artifact: {path.name}"
        return path.read_text()

    def _parse_ts(self, value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None

    def push(self) -> dict[str, Any]:
        if not self.client.is_configured():
            return {"status": "error", "message": "Linear not configured"}

        team_id = self.client.config.team_id or self.client.get_first_team_id()
        if not team_id:
            return {"status": "error", "message": "No Linear team found"}

        mapping = self._read_mapping()
        mapping.setdefault("artifacts", {})

        created = 0
        updated = 0
        skipped = 0
        created_ids: list[str] = []
        created_identifiers: list[str] = []
        updated_identifiers: list[str] = []
        errors: list[str] = []
        warnings: list[str] = []

        label_ids: list[str] | None = None
        if self.client.config.push_label:
            label_id = self.client.get_label_id(team_id=team_id, name=self.client.config.push_label)
            if label_id:
                label_ids = [label_id]
            else:
                warnings.append(f"push_label_not_found:{self.client.config.push_label}")

        for artifact in self.store.list_artifacts():
            artifact_id = artifact["id"]
            title = artifact.get("name") or "Untitled"
            description = self._artifact_description(artifact)
            entry = mapping["artifacts"].get(artifact_id)
            try:
                issue_id = entry.get("issue_id") if entry else None
                if issue_id:
                    updated_issue = self.client.update_issue(
                        issue_id=issue_id,
                        title=title,
                        description=description,
                    )
                    updated += 1
                    updated_identifiers.append(updated_issue["identifier"])
                    if entry is not None:
                        entry["issue_identifier"] = updated_issue["identifier"]
                else:
                    created_issue = self.client.create_issue(
                        title=title,
                        description=description,
                        team_id=team_id,
                        project_id=self.client.config.project_id,
                        label_ids=label_ids,
                    )
                    mapping["artifacts"][artifact_id] = {
                        "issue_id": created_issue["id"],
                        "issue_identifier": created_issue["identifier"],
                    }
                    created += 1
                    created_ids.append(created_issue["id"])
                    created_identifiers.append(created_issue["identifier"])
                entry = mapping["artifacts"].get(artifact_id)
                if entry is None:
                    continue
                path = self.store.get_artifact_path(artifact)
                if not path.exists():
                    continue
                mime_type = artifact.get("mime_type") or "application/octet-stream"
                should_attach = mime_type != "text/markdown"
                if should_attach:
                    stat = path.stat()
                    last_mtime = entry.get("attachment_mtime")
                    last_size = entry.get("attachment_size")
                    if last_mtime != stat.st_mtime or last_size != stat.st_size:
                        upload = self.client.file_upload(
                            content_type=mime_type,
                            filename=path.name,
                            size=int(stat.st_size),
                        )
                        headers = {h["key"]: h["value"] for h in upload.get("headers", []) if h.get("key")}
                        headers.setdefault("Content-Type", mime_type)
                        with path.open("rb") as handle:
                            response = httpx.put(upload["uploadUrl"], data=handle, headers=headers, timeout=60)
                            response.raise_for_status()
                        attachment_id = self.client.create_attachment(
                            issue_id=entry["issue_id"],
                            title=title,
                            url=upload["assetUrl"],
                        )
                        entry["attachment_id"] = attachment_id
                        entry["attachment_url"] = upload["assetUrl"]
                        entry["attachment_mtime"] = stat.st_mtime
                        entry["attachment_size"] = stat.st_size
                entry["last_pushed_at"] = datetime.now(timezone.utc).isoformat()
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{artifact_id}: {exc}")
                skipped += 1

        self._write_mapping(mapping)
        return {
            "status": "ok",
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "created_issue_ids": created_ids,
            "created_issue_identifiers": created_identifiers,
            "updated_issue_identifiers": updated_identifiers,
            "errors": errors,
            "warnings": warnings,
        }

    def pull(self) -> dict[str, Any]:
        if not self.client.is_configured():
            return {"status": "error", "message": "Linear not configured"}

        mapping = self._read_mapping()
        mapping.setdefault("artifacts", {})

        updated = 0
        skipped = 0
        updated_identifiers: list[str] = []
        created_identifiers: list[str] = []
        conflicts: list[str] = []
        errors: list[str] = []

        for artifact_id, entry in mapping["artifacts"].items():
            issue_id = entry.get("issue_id")
            if not issue_id:
                skipped += 1
                continue
            try:
                issue = self.client.get_issue(issue_id=issue_id)
                issue_description = issue.get("description") or ""
                local_artifact = self.store.get_artifact(artifact_id)
                local_path = self.store.get_artifact_path(local_artifact) if local_artifact else None
                local_content = local_path.read_text() if local_path and local_path.exists() else ""
                last_pulled_at = self._parse_ts(entry.get("last_pulled_at"))
                local_updated_at = self._parse_ts(local_artifact.get("updated_at") if local_artifact else None)
                if local_artifact and local_content != issue_description:
                    if local_updated_at and (not last_pulled_at or local_updated_at > last_pulled_at):
                        conflict_note = "Local edits detected during pull; conflict copy created."
                        self.store.create_conflict_copy(
                            artifact_id=artifact_id,
                            source="linear",
                            note=conflict_note,
                        )
                        conflicts.append(artifact_id)
                updated_artifact = self.store.update_artifact(
                    artifact_id,
                    name=issue.get("title"),
                    content=issue_description,
                )
                if updated_artifact:
                    updated += 1
                    identifier = issue.get("identifier")
                    team = issue.get("team") or {}
                    project = issue.get("project") or {}
                    entry["issue_identifier"] = identifier
                    entry["issue_team_name"] = team.get("name")
                    entry["issue_team_id"] = team.get("id")
                    entry["issue_project_name"] = project.get("name")
                    entry["issue_project_id"] = project.get("id")
                    entry["last_pulled_at"] = datetime.now(timezone.utc).isoformat()
                    if identifier:
                        updated_identifiers.append(identifier)
                else:
                    skipped += 1
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{artifact_id}: {exc}")
                skipped += 1

        if self.client.config.pull_create:
            if not self.client.config.pull_label:
                errors.append("pull_create: LINEAR_PULL_LABEL is required")
                self._write_mapping(mapping)
                return {
                    "status": "ok",
                    "updated": updated,
                    "skipped": skipped,
                    "created_issue_identifiers": created_identifiers,
                    "updated_issue_identifiers": updated_identifiers,
                    "conflict_artifact_ids": conflicts,
                    "errors": errors,
                }
            mapped_issue_ids = {
                entry.get("issue_id") for entry in mapping["artifacts"].values() if entry.get("issue_id")
            }
            try:
                issues = self.client.list_issues()
                for issue in issues:
                    issue_id = issue.get("id")
                    if not issue_id or issue_id in mapped_issue_ids:
                        continue
                    labels = issue.get("labels") or {}
                    label_nodes = labels.get("nodes") or []
                    label_names = {label.get("name") for label in label_nodes if label}
                    if self.client.config.pull_label not in label_names:
                        continue
                    artifact = self.store.create_artifact(
                        name=issue.get("title") or "Untitled",
                        content=issue.get("description") or "",
                        kind="note",
                        mime_type="text/markdown",
                        tags=["linear", "imported"],
                    )
                    pulled_at = datetime.now(timezone.utc).isoformat()
                    identifier = issue.get("identifier")
                    team = issue.get("team") or {}
                    project = issue.get("project") or {}
                    mapping["artifacts"][artifact["id"]] = {
                        "issue_id": issue_id,
                        "issue_identifier": identifier,
                        "issue_team_name": team.get("name"),
                        "issue_team_id": team.get("id"),
                        "issue_project_name": project.get("name"),
                        "issue_project_id": project.get("id"),
                        "last_pulled_at": pulled_at,
                    }
                    if identifier:
                        created_identifiers.append(identifier)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"pull_create: {exc}")

        self._write_mapping(mapping)
        return {
            "status": "ok",
            "updated": updated,
            "skipped": skipped,
            "created_issue_identifiers": created_identifiers,
            "updated_issue_identifiers": updated_identifiers,
            "conflict_artifact_ids": conflicts,
            "errors": errors,
        }
