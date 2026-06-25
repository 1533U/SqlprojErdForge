# SqlprojErdForge

A VS Code extension that renders a **live, bidirectional ERD** (entity-relationship
diagram) for a SQL Server **database project** (`.sqlproj`) — driven entirely by the
project's `.sql` files, with **no database connection required**.

> The diagram is a live representation of your *project*, not your *database*.

## What it does

- **Reads** the declarative `CREATE TABLE` files in a `.sqlproj` and builds an in-memory
  schema model (tables, columns, keys, foreign keys).
- **Renders** that model as an interactive ERD inside a VS Code webview, and keeps it
  **live** — when you edit a `.sql` file, the diagram updates.
- **Writes back**: edits made on the diagram (add a table, add/rename a column, add a
  foreign key, …) are emitted back into the `.sql` files as clean, reviewable changes.

## Why it exists

The tooling landscape has connected-DB ERD tools (SSMS, dbForge, DBeaver), static
SQL-to-ERD generators (SchemaSpy, Azimutt, ChartDB), and Microsoft's own SQL Database
Projects extension — but **none** offer a live, file-driven, `.sqlproj`-native,
bidirectional ERD inside the editor. This tool fills that gap for internal use.

## Key design stance

This is an **internal tool** and is deliberately **opinionated**. It supports a
constrained, declarative T-SQL subset and a canonical file format rather than the full
generality of T-SQL. That single decision is what makes a pure-TypeScript parser,
reliable round-tripping, and clean review diffs achievable. See
[`docs/03-sql-conventions.md`](docs/03-sql-conventions.md).

## Tech stack (summary)

| Concern | Choice |
|---|---|
| Delivery | VS Code extension (TypeScript) |
| Parsing / emitting | Pure-TypeScript parser + canonical emitter (no .NET sidecar) |
| Schema model | In-memory, derived from `.sql` files (single source of truth) |
| Diagram UI | Webview hosting React + React Flow + ELK auto-layout |
| Live updates | `FileSystemWatcher` → re-parse → patch model |
| Layout persistence | Committed JSON sidecar (`.erdforge/layout.json`) |
| Correctness backstop | DACPAC build in CI (optional gate, not a runtime dep) |

See [`docs/02-architecture.md`](docs/02-architecture.md) for the full picture and
[`docs/decisions/`](docs/decisions/) for the rationale behind each choice.

## Documentation map

**Start here:** [`docs/STATUS.md`](docs/STATUS.md) for the current state, and
[`AGENTS.md`](AGENTS.md) for how this repo is tracked and kept tidy.

| Doc | Purpose |
|---|---|
| [`docs/STATUS.md`](docs/STATUS.md) | Living snapshot — where the project is right now |
| [`docs/backlog.md`](docs/backlog.md) | Granular task list by phase |
| [`CHANGELOG.md`](CHANGELOG.md) | History of notable changes |
| [`AGENTS.md`](AGENTS.md) | Operating manual: how to track, manage, and clean the repo |
| [`docs/01-scope.md`](docs/01-scope.md) | Goals, non-goals, success criteria |
| [`docs/02-architecture.md`](docs/02-architecture.md) | Components, data flow, tech stack |
| [`docs/03-sql-conventions.md`](docs/03-sql-conventions.md) | The opinionated SQL subset & canonical format |
| [`docs/04-comment-model.md`](docs/04-comment-model.md) | How comments are parsed, attached, and re-emitted |
| [`docs/05-data-model.md`](docs/05-data-model.md) | In-memory model types + layout sidecar format |
| [`docs/06-edit-ux.md`](docs/06-edit-ux.md) | How ERD edits are previewed and applied |
| [`docs/07-roadmap.md`](docs/07-roadmap.md) | Phased plan, milestones, the de-risking spike |
| [`docs/decisions/`](docs/decisions/) | Architecture Decision Records (ADRs) |

## Status

**Phase 0 complete** — the parse↔emit idempotency spike is implemented and green on the
fixture corpus. Phase 1 (VS Code extension + read-only ERD) is next. See
[`docs/STATUS.md`](docs/STATUS.md) for the live snapshot.

## Quick start (Phase 0 spike)

Requires Node.js (runs TypeScript natively; no build step).

```bash
npm install
npm run spike        # fixture corpus: idempotency, comments, C9, C10 — must pass
npm run spike:real   # read-only discovery smoke test on the real ~760-file project
npm run typecheck
```

Entry points: [`src/cli.ts`](src/cli.ts) (harness), [`test/fixtures/SampleErd.sqlproj`](test/fixtures/SampleErd.sqlproj) (synthetic project).
