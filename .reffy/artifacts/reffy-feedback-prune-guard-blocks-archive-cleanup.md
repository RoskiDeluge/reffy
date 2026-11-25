# Durable Forms feedback on archive cleanup

Source: `.reffy/artifacts/reffy-feedback-prune-guard-blocks-archive-cleanup.md` in the `durable-forms` project in `nuveris-v1`, published November 25, 2026. This note summarizes the upstream report.

On Reffy 1.12.1, archiving `add-monad-thread` moved seven change files into `changes/archive/2026-11-25-add-monad-thread/`. A keep-missing push published the archive. A pruning dry run then listed only the seven stale active paths, but these represented 7 of 59 remote project documents (11.9%). The 5% guard refused the push. The archive skill prohibited `--force` for cleanup, so the owner approved a one-off forced prune. The report records the same outcome for both `nuveris-v1` and `lasm-v1`.

The report prefers exempting moves into the matching archive and keeping the guard for other deletions. It also considers a scoped prune or an absolute deletion floor and asks for explicit skill guidance when the guard still refuses cleanup.
