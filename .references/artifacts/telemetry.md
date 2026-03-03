# Telemetry Implementation Notes (Pre-Spec)

This is a concrete implementation sketch for a minimal telemetry v1, without locking into a full proposal yet.

## Goals

- Understand top-level CLI usage patterns.
- Keep collection intentionally minimal and privacy-safe.
- Make telemetry easy to disable and easy to reason about.

## v1 Event Shape

Send one event per CLI invocation:

```json
{
  "event": "command_executed",
  "command": "<top-level-command>",
  "version": "<cli-version>",
  "exit_code": 0,
  "ts": "2026-02-26T00:00:00.000Z"
}
```

Notes:
- `command` is only the first command token (example: `init`, `reindex`, `validate`).
- Never include raw argv, file paths, free text, stack traces, or user content.
- `exit_code` is optional but useful for basic reliability signal.

## Enable/Disable Behavior

Default behavior:
- Enabled by default for local interactive usage.

Hard disable conditions (checked in this order):
1. `DO_NOT_TRACK=1` -> disabled
2. Project env flag (example: `REFFY_TELEMETRY=0`) -> disabled
3. CI environment (`CI=true`) -> disabled

Recommendation:
- Expose one project-specific variable (for example `REFFY_TELEMETRY`) and document accepted values: `0|false|off` as disabled.

## Runtime Flow

1. CLI starts and parses command.
2. Build telemetry context once: enabled state + version + command.
3. Execute command.
4. On completion (or handled failure), emit one sanitized event if enabled.
5. Telemetry send failures are swallowed (never fail the command).

Guardrails:
- Send should have a short timeout.
- Send should run best-effort and not block CLI exit for long.

## Suggested Module Boundaries

- `telemetry/config.ts`
  - env parsing and `isTelemetryEnabled()`
- `telemetry/event.ts`
  - strict event type + sanitizer for command names
- `telemetry/client.ts`
  - transport function (`track(event)`)
- `telemetry/index.ts`
  - small facade used by command runner

Keep telemetry behind a tiny interface so transport can change later without touching command code.

## Logging and UX

- No noisy logs by default.
- Optional debug logging behind a dedicated flag (example: `DEBUG_TELEMETRY=1`).
- Add a short privacy section in README:
  - what is collected
  - what is not collected
  - how to opt out

## Rollout Steps

1. Implement in-memory event builder and `isTelemetryEnabled()`.
2. Wire one command path end-to-end.
3. Add tests for:
   - opt-out env vars
   - CI auto-disable
   - payload excludes args/paths/content
4. Expand to all commands.
5. Add docs and changelog note.

## Open Questions for Next Iteration

- Should `exit_code` be included in v1 or deferred?
- Should we include a coarse OS field (`darwin/linux/windows`) or keep only command+version?
- Do we want a `telemetry status` command for user transparency?
