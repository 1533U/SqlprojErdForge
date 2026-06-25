# 02 — Architecture

## Guiding principle

The `.sql` files are the **single source of truth**. Everything else — the schema model,
the diagram, even any cache — is **derived** from them and is disposable. We never create
a second authoritative store of schema data that could drift from the files.

## High-level data flow

```
                         ┌────────────────────────────────────────────┐
                         │                .sqlproj                      │
                         │   dbo.Customer.sql   sales.Invoice.sql  ...  │  ← source of truth
                         └───────────────┬──────────────────────────────┘
                                         │ parse (pure TS)
                                         ▼
                          ┌──────────────────────────────┐
                          │      In-memory schema model    │  ← derived, disposable
                          │  Tables / Columns / Keys / FKs │
                          │  + comment trivia              │
                          └───────────────┬────────────────┘
                       emit (canonical)   │   project model → diagram
                                ▲         ▼
        ┌───────────────────────┴───┐   ┌──────────────────────────────┐
        │  Canonical emitter         │   │  Webview (React + React Flow) │
        │  model → .sql text         │   │  interactive ERD              │
        └───────────────────────────┘   └───────────────┬───────────────┘
                       ▲                                  │ user edits the diagram
                       │  edit intent (add FK, add col…)  │
                       └──────────────────────────────────┘
                                         │ apply
                                         ▼
                        Diff preview  →  user confirms  →  WorkspaceEdit

   FileSystemWatcher on *.sql ──► re-parse changed file ──► patch model ──► refresh ERD
   Layout (x/y) ◄──────────────► .erdforge/layout.json  (committed JSON sidecar)
```

## Components

### 1. Project loader
- Discovers the `.sqlproj` and the set of `.sql` files it includes.
- Conventions let us keep this simple: one table per file, file name = `schema.table.sql`.
- Produces the ordered list of source files to parse.

### 2. Parser (pure TypeScript)
- Parses the supported declarative T-SQL subset (`CREATE TABLE` + table-level
  constraints) into the in-memory model.
- **Comment-aware**: captures comments as trivia and attaches them to the correct
  member/table (see [`04-comment-model.md`](04-comment-model.md)).
- **Fails loudly**: anything outside the subset becomes a diagnostic with file + line,
  never a silent drop or misread.
- Implementation options: hand-written recursive-descent over the small DDL grammar, or
  a grammar via [Chevrotain](https://chevrotain.io/). Decision deferred to the Phase 0
  spike; recursive-descent is the leading candidate for a subset this small.

### 3. Schema model (in-memory)
- Plain TypeScript data structures (see [`05-data-model.md`](05-data-model.md)).
- Rebuilt from files on change. Order of members is preserved exactly as written.

### 4. Canonical emitter
- Turns a (possibly edited) model back into `.sql` text in one deterministic canonical
  style. Because the on-disk format *is* the emitter's output, regenerating a whole file
  produces a minimal diff.
- **Must preserve member order** and re-emit comment trivia in place.

### 5. Diagram UI (webview)
- A React app hosted in a VS Code webview panel.
- **React Flow** for interactive nodes/edges; **ELK** (`elkjs`) for auto-layout of new
  or unpositioned tables.
- Communicates with the extension host over the webview message channel: host → webview
  sends the model; webview → host sends edit intents.

### 6. Live sync
- A `FileSystemWatcher` on the project's `.sql` files. On change, only the changed file is
  re-parsed and the model patched, then the diagram is refreshed. Debounced to avoid
  thrash on rapid saves.

### 7. Layout store
- Diagram presentation (x/y, collapsed, color) is **not** schema and is never written into
  `.sql`. It lives in `.erdforge/layout.json`, keyed by `schema.table`, committed to Git
  so the team shares one curated layout. See [`05-data-model.md`](05-data-model.md).

### 8. Edit-apply pipeline
- An edit intent from the diagram mutates a copy of the model, the emitter regenerates the
  affected file(s), and the change is shown as a **diff preview** the user confirms or
  discards before it is applied via `WorkspaceEdit`. See [`06-edit-ux.md`](06-edit-ux.md).

## Tech stack and rationale

| Layer | Choice | Why |
|---|---|---|
| Editor integration | VS Code extension (TypeScript) | Lives where the project is authored; webview + watcher APIs fit perfectly |
| Parser/emitter | Pure TypeScript | No second runtime to install/package; subset is small enough thanks to conventions ([ADR-0002](decisions/ADR-0002-pure-typescript-parser.md)) |
| Schema model | In-memory, derived | Files stay the single source of truth; no drift ([ADR-0004](decisions/ADR-0004-in-memory-model-no-sqlite.md)) |
| Diagram | React + React Flow + ELK | Mature interactive-graph + layout stack |
| Layout persistence | Committed JSON sidecar | Tiny, diffable, shareable; avoids binary store ([ADR-0005](decisions/ADR-0005-layout-sidecar.md)) |
| Correctness backstop | DACPAC build in CI | Catches anything the lenient parser misses, without being a runtime dependency |

## Why not a .NET sidecar (DacFx/ScriptDom)?

Microsoft's `ScriptDom`/`DacFx` are the gold standard for *general* T-SQL, but they are
.NET and would force a second runtime into the extension. Because we constrain the input
to a declarative subset, a pure-TS parser is sufficient, and we keep DacFx only as an
**optional CI validation gate** (build the DACPAC to confirm correctness). Full rationale
in [ADR-0002](decisions/ADR-0002-pure-typescript-parser.md).

## Failure & safety model

- Parser errors → VS Code diagnostics; the offending table is excluded, the rest of the
  ERD still renders.
- Every write goes through a diff preview and the normal undo stack; `.sql` files are
  Git-tracked so there is always a recoverable before/after.
- The model can always be rebuilt from scratch by re-reading the files.
