from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Callable

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer


class _DebouncedHandler(FileSystemEventHandler):
    def __init__(self, on_change: Callable[[set[str]], None], debounce_seconds: float) -> None:
        self._on_change = on_change
        self._debounce_seconds = debounce_seconds
        self._timer: threading.Timer | None = None
        self._lock = threading.Lock()
        self._paths: set[str] = set()

    def on_any_event(self, event) -> None:  # noqa: ANN001
        if event.is_directory:
            return
        with self._lock:
            src_path = getattr(event, "src_path", None)
            if src_path:
                self._paths.add(str(src_path))
            if self._timer:
                self._timer.cancel()
            self._timer = threading.Timer(self._debounce_seconds, self._fire)
            self._timer.daemon = True
            self._timer.start()

    def _fire(self) -> None:
        with self._lock:
            paths = set(self._paths)
            self._paths.clear()
        self._on_change(paths)

    def cancel(self) -> None:
        with self._lock:
            if self._timer:
                self._timer.cancel()
                self._timer = None


class ReferencesWatcher:
    def __init__(self, refs_dir: Path, on_change: Callable[[set[str]], None]) -> None:
        self.refs_dir = refs_dir
        self.on_change = on_change
        self._observer = Observer()
        self._handler: _DebouncedHandler | None = None

    @classmethod
    def enabled(cls) -> bool:
        return os.getenv("LINEAR_WATCH") == "1"

    def start(self) -> None:
        debounce_seconds = float(os.getenv("LINEAR_WATCH_DEBOUNCE", "1.0"))
        self._handler = _DebouncedHandler(self.on_change, debounce_seconds)
        self._observer.schedule(self._handler, str(self.refs_dir), recursive=True)
        self._observer.start()

    def stop(self) -> None:
        if self._handler:
            self._handler.cancel()
        self._observer.stop()
        self._observer.join(timeout=2)
