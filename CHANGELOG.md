# Changelog

All notable changes to this project are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/); dates are ISO `YYYY-MM-DD`.
Append meaningful changes to `Unreleased` as part of the "document progress" routine
(see [`AGENTS.md`](AGENTS.md)).

## [Unreleased]

### Changed
- **Docs synced** for Phase 3 progress: STATUS, backlog (`P3-8` partial done), README
  (`verify:p3`), roadmap (ops 1–2 shipped), and architecture (edit layer + parser ADR-0009).
- **Phase 3 refactor:** deduplicated edit pipeline (`buildFileEditCandidate`, per-op mutation
  helpers, shared `validateEditableTable` / `findColumn` / `splitTableKey`), unified host/webview
  protocol types in `src/protocol/`, generic `handlePrepareEdit` in the extension panel, grouped
  webview edit session state, and slimmer `verify:p3` helpers in `src/cli.ts`. Behavior unchanged.

### Added
- **Phase 3 — drop table** (`P3-6`): webview **Drop table** mode (table header pick → inbound-FK
  warning → preview); edit op in `src/edits/dropTable.ts` deletes the `.sql` file, removes the
  `.sqlproj` build item, and strips the layout entry in lockstep; `FileEditCandidate.isDeleteFile`
  for diff-preview apply; registered as seventh edit op; `npm run verify:p3` extended.
- **Phase 3 — add table** (`P3-5`): webview **Add table** mode (schema + table name → preview);
  edit op in `src/edits/addTable.ts` emits canonical CREATE TABLE, inserts a `.sqlproj`
  `<Build Include>` when needed (`src/edits/sqlprojEdit.ts`), and adds a layout sidecar entry
  in lockstep; `FileEditCandidate.isNewFile` + diff-preview apply path for file creation;
  registered as sixth edit op; `npm run verify:p3` extended.
- **Phase 3 — change column type / nullability** (`P3-4`): webview **Change column** mode
  (column pick → type/nullable form → preview); edit op in `src/edits/changeColumn.ts` with
  shared guardrails in `columnTypeChangeBlockReason`; registered in edit registry;
  `npm run verify:p3` extended.
- **Phase 3 — rename column** (`P3-3`): webview **Rename column** mode (column pick → new name
  → preview); edit op in `src/edits/renameColumn.ts` propagates renames to PK/unique/FK local
  columns, PERIOD bounds, and inbound `REFERENCES` across files; multi-file sequential diff
  preview (`1/N`); `EditValidationResult` now returns `candidates[]`; `npm run verify:p3`
  extended.
- **Phase 3 — add / remove column** (`P3-2`): webview **Add column** (table header → name/type/
  nullable/description → preview) and **Remove column** (column pick → preview); edit ops in
  `src/edits/addColumn.ts` and `src/edits/removeColumn.ts` with PK/FK/inbound-FK guardrails on
  remove; `npm run verify:p3` extended.
- **Phase 3 — add foreign key** (`P3-1`): webview **Add FK** mode (source column → target PK),
  edit layer in `src/edits/`, diff preview with **Apply** / **Discard** editor actions, conflict
  check on stale apply. `npm run verify:p3` for headless validation.
- **Phase 2 column comments** (`P2-1`, `P2-2`): member `trailingComment` is serialized as
  `GraphColumn.description` and shown as an annotation row on table nodes; webview header
  toggle **Show column descriptions** (default on). `leadingComments` not rendered in v1.
- **`npm run verify:p1`** — headless Phase 1 exit-criteria checks: fixture + real-project graph
  build with ELK layout, layout sidecar roundtrip, live-refresh timing, and scale thresholds.
- **Phase 1 read-only ERD** (`P1-1`…`P1-6`): VS Code extension with **Open ERD** command on
  `.sqlproj` files; webview React app with React Flow table nodes (PK/FK/NN badges) and FK
  edge lines; ELK auto-layout for unpositioned tables; debounced `FileSystemWatcher`
  refresh; `.erdforge/layout.json` sidecar read/write on drag; parse diagnostics in the
  Problems panel. Build with `npm run compile`; F5 via `.vscode/launch.json`. Exit criteria
  verified on fixtures and real project (`npm run verify:p1`, 2026-06-25).
- Committed sample layout sidecar at `test/fixtures/.erdforge/layout.json` (ADR-0005).
- VS Code dev config: `.vscode/launch.json`, `.vscode/tasks.json`.
- Extension/webview build via `esbuild.mjs`; split TypeScript configs for spike, extension,
  and webview.
- **Phase 0 parser/emitter spike** (`src/`): trivia-preserving tokenizer
  (`src/tokenizer.ts`), hand-written recursive-descent parser (`src/parser.ts`), canonical
  emitter (`src/emitter.ts`), `.sqlproj` project loader (`src/project.ts`), FK-only ERD edge
  derivation (`src/erd.ts`), and a CLI test harness (`src/cli.ts`). Run with `npm run spike`
  (fixtures) and `npm run spike:real` (discovery smoke test). TypeScript runs natively on
  Node (type-stripping); `npm run typecheck` gates types.
- **4 new ADRs** settling the Phase 0 open decisions: `ADR-0009` (hand-written
  recursive-descent parser), `ADR-0010` (D1 — lazy "format on touch" canonicalization),
  `ADR-0011` (D2 — Syspro mirror tables are read-only), `ADR-0012` (allowlist scope: temporal
  columns + `PERIOD`, non-fatal post-`GO` handling). ADR index updated.
- Comment-slots fixture `test/fixtures/comments/dbo.CommentSlots.sql` (all four comment slots
  + the rule-5 footer fallback), referenced from `SampleErd.sqlproj` (`P0-1c`).
- Initial project design documentation (`docs/01`–`07`): scope, architecture, SQL
  conventions, comment model, data model, edit/apply UX, and roadmap.
- 7 Architecture Decision Records (`docs/decisions/ADR-0001`–`0007`).
- Project README with overview, tech stack, and documentation map.
- `.gitignore` for the future VS Code extension (keeps `.erdforge/layout.json` committed).
- Project-management scaffolding: `AGENTS.md` (operating manual), `docs/STATUS.md`
  (living snapshot), `docs/backlog.md` (task list), and this changelog.
- Test fixture corpus under `test/fixtures/` (curated from the example
  `OSConnectWeylandtsDB` project) with a documented README, unblocking Phase 0 (`P0-1`).
- Synthetic `test/fixtures/SampleErd.sqlproj` entry point so project discovery is tested
  from the `.sqlproj` (MSBuild XML, backslash paths, build-item filtering) rather than a
  folder scan (`P0-1b`); added loader tasks `P0-12`/`P0-13` and detailed the Project loader
  component in `02-architecture.md`.

### Fixed
- Fixture layout sidecar keyed `dbo.CommentSlots` while the table is `dbo.Customer` — corrected
  in `test/fixtures/.erdforge/layout.json` so drag-to-persist applies to the comment-slots table.
- Extension activation under `"type": "module"`: host entry is `out/extension.cjs` (CommonJS).
- ELK layout crash when an FK references a table outside the project (e.g.
  `dbo.pr_tariff_code` in fixtures) — diagram edges now require both endpoints as nodes.
- React Flow FK lines invisible on custom table nodes — added connection handles and themed
  edge styling.

### Changed
- README status + quick-start: Phase 1 complete; added `npm run verify:p1` to quick start.
- `docs/STATUS.md`, `docs/backlog.md`, and `docs/07-roadmap.md` synced for Phase 1 completion.
- Added convention **C9**: commented-out schema (tables, columns, constraints) is ignored
  entirely — no model entry, no ERD node, no diagnostic. Updated `03-sql-conventions.md`,
  `04-comment-model.md`, and backlog `P0-9`.
- Added convention **C10** + **ADR-0008**: ERD relationships are derived **only** from
  declared `FOREIGN KEY` constraints and are **never inferred** from names/types. Updated
  `03`, `05`, the ADR index, and backlog (`P0-11`).
- Reframed the Phase 0 idempotency exit criterion to a realistic "stable fixed point after
  one normalization pass + acceptable minimal diff" (true byte-stability on messy input is
  not the bar).
- Expanded the roadmap risk register with R1–R4 (formatting-vs-real-files, idempotency bar,
  Syspro mirror tables, parser effort) and added open decisions D1 (formatting strategy)
  and D2 (Syspro mirror scope).

### Notes
- **Phase 0 exit criteria met on the fixture corpus:** stable fixed point
  (`emit(parse(emit(x))) === emit(parse(x))`) on every fixture; all four comment slots +
  rule-5 fallback preserved; commented-out schema ignored (C9); edges only from declared FKs
  (C10); unsupported constructs raise loud diagnostics without crashing.
- The `P0-13` smoke test ran discovery over the real 760-item project (read-only): 96 tables,
  125 FK edges, no crashes. Coverage gaps (proc/view files, post-`GO` objects, extra column
  modifiers) captured as `P0-14`; exact canonical formatting rules captured as `P0-15`.
- Reconnaissance of the example project surfaced real-world syntax to handle (bracket
  identifiers, `CLUSTERED` PKs with index options, commented-out tables/columns, unusual
  identifiers like `PorMasterHdr+`, `IDENTITY`/`DEFAULT`/`COLLATE`); captured as backlog
  `P0-8`/`P0-9` and in `docs/STATUS.md`.
