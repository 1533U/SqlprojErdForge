# AGENTS.md — Operating manual for this repo

This file tells any agent session how to **track, manage, and tidy** this project so state
is consistent across chats. Read it first. Keep it short and current.

## Where project state lives (single sources of truth)

| Question | File |
|---|---|
| What is this project? | [`README.md`](README.md) |
| Where are we right now? | [`docs/STATUS.md`](docs/STATUS.md) ← **the snapshot, always current** |
| What's the granular task list? | [`docs/backlog.md`](docs/backlog.md) |
| What changed over time? | [`CHANGELOG.md`](CHANGELOG.md) |
| Why was something decided? | [`docs/decisions/`](docs/decisions/) (ADRs) |
| The plan / phases | [`docs/07-roadmap.md`](docs/07-roadmap.md) |
| Design specs | [`docs/01`…`06`](docs/) |

**`docs/STATUS.md` is the entry point.** Read it at the start of every session to learn the
current phase, what's in progress, and what's next.

## Routine: "clean the repo and document progress"

When the user asks to clean up / document progress (they will, often), run this checklist:

1. **Sync STATUS.** Update [`docs/STATUS.md`](docs/STATUS.md): move items between
   Done / In&nbsp;progress / Next / Blocked, refresh "Last updated", note open decisions.
2. **Update the backlog.** In [`docs/backlog.md`](docs/backlog.md), flip task statuses,
   add newly discovered tasks (with IDs), close finished ones.
3. **Append to the changelog.** Add meaningful changes to the `Unreleased` section of
   [`CHANGELOG.md`](CHANGELOG.md) (Keep a Changelog style).
4. **Record decisions.** Any new architectural decision → a new ADR (never edit accepted
   ones; supersede instead). Update the ADR index.
5. **Tidy the tree.** Remove stray/scratch files, dead code, and build artifacts; ensure
   nothing committed is in `.gitignore`'s spirit (no `node_modules/`, `out/`, `*.vsix`).
6. **Check doc integrity.** No broken relative links; docs stay numbered/ordered; new docs
   are linked from `README.md` and, if structural, from this file.
7. **Report.** Summarize what changed and what's next. Only commit if the user asks.

## Cleanliness rules

- **No orphan files.** Every file has a clear home: root for project-level (`README`,
  `AGENTS`, `CHANGELOG`, configs), `docs/` for docs, `docs/decisions/` for ADRs, and
  (once code exists) `src/`, `test/`, etc.
- **Docs are numbered** (`NN-name.md`) to keep reading order; ADRs are `ADR-NNNN-*.md`.
- **No build artifacts or secrets** in Git. Honor [`.gitignore`](.gitignore). The one
  intentional exception: `.erdforge/layout.json` is committed (see ADR-0005).
- **Keep STATUS truthful.** If STATUS and reality disagree, STATUS is wrong — fix it.

## Decision & change conventions

- **Decisions** → ADRs (immutable; supersede via a new ADR). Index in
  [`docs/decisions/README.md`](docs/decisions/README.md).
- **Progress history** → `CHANGELOG.md` (append-only).
- **Dates** use ISO `YYYY-MM-DD`.
- **Commits** only when the user explicitly asks. Use clear, scoped messages.

## Code conventions (apply once implementation starts)

- TypeScript throughout; imports at top of file (no inline imports).
- Exhaustive `switch` over discriminated unions/enums with a `never` default case
  (the data model in [`docs/05-data-model.md`](docs/05-data-model.md) relies on this).
- The `.sql` parser/emitter must honor the conventions in
  [`docs/03-sql-conventions.md`](docs/03-sql-conventions.md) and the comment model in
  [`docs/04-comment-model.md`](docs/04-comment-model.md).

## Definition of "progress documented"

A change is properly documented when: STATUS reflects it, the backlog status is updated,
the changelog has an entry, and (if it was a decision) an ADR exists. If all four are true,
a new session can pick up exactly where the last one left off.
