# Bug Report: Binary artifacts are irreversibly corrupted by `reffy remote push` / `cat`

## Summary
Binary artifacts (e.g. PDFs) pushed to a Paseo-backed remote workspace are stored as lossy UTF-8 text. The bytes are destroyed at import time, so `reffy remote cat` cannot return a usable file, and the remote projection silently holds a corrupted copy while reporting `status: ok`.

## Environment
- Date observed: 2026-07-07
- CLI: `reffy remote` (workspace `nuveris-v1`, endpoint `https://paseo-core.paseo.workers.dev`, backend `reffyRemoteBackend v2`)
- Reading project: `popper`; source project: `paseo-core`
- Affected document: `.reffy/artifacts/skillopt.pdf` (any binary artifact should reproduce)

## Steps to reproduce
1. In a project whose `.reffy/artifacts/` contains a binary file (a real PDF, ~1.5 MB), run `reffy remote push`.
2. From any project registered to the same workspace, run:
   `reffy remote cat .reffy/artifacts/skillopt.pdf --project-id paseo-core --output json`
3. Inspect `document.content`.

## Expected
The original bytes round-trip (or the CLI refuses to import binary content with a clear error).

## Actual
The command succeeds (`status: ok`) but the content is unrecoverable:

- `document.content_type` is `text/plain`; `document.metadata.source` is `local-reffy-import`.
- `document.metadata.size_bytes` records the original file: **1,503,833 bytes**. The stored `content` string is only **839,826 characters**, of which **317,832 are U+FFFD** (the Unicode replacement character).
- The corruption is visible from the first line: the PDF header reads `%PDF-1.7\n%����` — the binary comment bytes after `%PDF-1.7` were replaced during a lossy UTF-8 decode.
- Reconstructing a file from the payload yields a PDF whose page tree parses (`pypdf` reports the correct outline structure) but whose compressed content streams are destroyed — every page extracts empty. The document is not recoverable from the remote.

## Diagnosis
The local import path decodes file bytes as UTF-8 with replacement (`errors="replace"` semantics) before storing them as a text document. Every byte sequence that is not valid UTF-8 — which is most of a PDF's compressed streams — collapses to U+FFFD. This is a one-way loss at **push/import time**, not a display problem in `cat`: the remote's stored copy is already corrupt.

Two secondary issues compound it:
1. **No error or warning.** Push and cat both report success. The mismatch between `metadata.size_bytes` (1,503,833) and the stored content length (839,826) is recorded but never checked.
2. **Misleading content type.** The document is served as `text/plain` even though the source is a PDF, so a consumer has no signal that it is looking at a lossy projection.

## Suggested fixes (in preference order)
1. Detect non-UTF-8 content at import and store it base64-encoded with a real content type (`application/pdf`, or `application/octet-stream` + an `encoding: base64` marker), decoding transparently on `cat`.
2. If binary support is out of scope for v2, refuse to import binary files with an explicit error and list them as skipped in the push summary — a loud gap is fine; a silent corruption is not.
3. Either way, validate `metadata.size_bytes` against stored content length on read and surface a warning when they diverge.

## Impact
Any workflow that treats the remote workspace as the source of truth for cross-project artifacts (the intended use — projects fetching each other's artifacts via `reffy remote cat`) silently loses every non-text artifact. In this instance the reader project had to fall back to the source project's local checkout to get faithful bytes, defeating the purpose of the remote projection.

## Evidence commands
```
reffy remote cat .reffy/artifacts/skillopt.pdf --project-id paseo-core --output json
# document.content_type      -> "text/plain"
# document.metadata.size_bytes -> 1503833
# len(document.content)      -> 839826, containing 317832 U+FFFD chars
# document.content[:20]      -> "%PDF-1.7\n%����\n1 0 obj"
```
