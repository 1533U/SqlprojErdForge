# STATUS — project snapshot

> The single place to learn "where are we?". Keep this current. See the update routine in
> [`../AGENTS.md`](../AGENTS.md).

**Last updated:** 2026-06-27
**Current phase:** Phase 3 in progress — next: change column type (`P3-4`)
**Overall state:** Phase 0–2 complete. Phase 3: **Add FK** (`P3-1`), **Add/remove column**
(`P3-2`), **Rename column** (`P3-3`), **single-file diff preview + Apply/Discard**
(`P3-8` partial), and the **edit-pipeline refactor** are landed and verified via
`npm run verify:p3`. Remaining Phase 3 ops (type change, table add/drop/rename) not started.
Multi-file rename uses sequential diff preview (Apply advances 1/N); full Refactor Preview
deferred to `P4-3`. Two Phase 0 follow-ups remain open (`P0-14`, `P0-15`).

## Done

- Project scope, architecture, and tech stack defined ([`docs/`](.)).
- SQL conventions, comment model, and data model specified.
- Edit/apply UX and phased roadmap documented.
- 12 ADRs recorded for the key decisions (ADR-0001…0012).
- Project-management scaffolding in place (AGENTS.md, STATUS, backlog, CHANGELOG).
- **Test fixture corpus** curated from the example `OSConnectWeylandtsDB` project
  ([`test/fixtures/`](../test/fixtures/)) — clean extension tables, a Syspro mirror table,
  edge cases (`P0-1`), and a comment-slots fixture exercising all four slots + the rule-5
  footer fallback ([`test/fixtures/comments/dbo.CommentSlots.sql`](../test/fixtures/comments/dbo.CommentSlots.sql)).
- **Synthetic `.sqlproj` entry point** ([`test/fixtures/SampleErd.sqlproj`](../test/fixtures/SampleErd.sqlproj))
  so discovery is tested from the project file, not a folder scan (`P0-1b`).
- **Decisions settled:** D1 formatting strategy → lazy canonicalization
  ([ADR-0010](decisions/ADR-0010-formatting-strategy-lazy-canonicalization.md)); D2 Syspro
  mirror tables → read-only ([ADR-0011](decisions/ADR-0011-syspro-mirror-read-only.md));
  parser → hand-written recursive-descent
  ([ADR-0009](decisions/ADR-0009-parser-recursive-descent.md)); allowlist extended for
  temporal/PERIOD + non-fatal post-`GO` handling
  ([ADR-0012](decisions/ADR-0012-allowlist-scope.md)).
- **Phase 0 spike implemented** ([`src/`](../src/)): trivia-preserving tokenizer, parser,
  canonical emitter, `.sqlproj` loader (`P0-12`), FK-only ERD edges (`P0-11`), and a CLI
  harness (`P0-5`). All exit criteria pass on the fixtures.
- **Discovery smoke test** (`P0-13`) against the real project (760 build items): 96 tables,
  125 FK edges, no crashes; coverage gaps captured for triage (see findings below).
- **Phase 1 read-only ERD** (`P1-1`…`P1-6`) — implemented and verified on fixtures via F5:
  - VS Code extension with **Open ERD** on `.sqlproj`
    ([`src/extension/`](../src/extension/), [`package.json`](../package.json),
    [`.vscode/launch.json`](../.vscode/launch.json)).
  - Webview React + React Flow (table nodes, PK/FK/NN badges, visible FK edge lines)
    ([`webview/`](../webview/)).
  - ELK auto-layout + grid fallback; edges filtered to tables present in the project
    ([`src/graph.ts`](../src/graph.ts)).
  - Debounced live refresh ([`src/extension/watcher.ts`](../src/extension/watcher.ts)).
  - Layout sidecar at `.erdforge/layout.json` — committed for fixtures
    ([`test/fixtures/.erdforge/layout.json`](../test/fixtures/.erdforge/layout.json)).
  - Parse diagnostics in Problems panel ([`src/extension/diagnostics.ts`](../src/extension/diagnostics.ts)).
  - Extension host entry is `out/extension.cjs` (CommonJS) because root `package.json` uses
    `"type": "module"` for the Node spike CLI.
- **Phase 1 exit criteria verified** (`npm run verify:p1`, 2026-06-25):
  - Real project ERD: 96 tables, 105 in-project FK edges (20 dangling omitted), ELK layout
    for all tables in ~750 ms; 606 diagnostics (9 errors from proc temp tables, 597 warnings).
  - Live refresh: re-parse + graph rebuild on fixture edit in ~160 ms (+ 500 ms debounce).
  - Drag-to-persist: layout sidecar write/read roundtrip; saved positions survive refresh.
- **Phase 2 column comments** (`P2-1`, `P2-2`, 2026-06-27):
  - `trailingComment` flows through `GraphColumn.description` ([`src/graph.ts`](../src/graph.ts))
    and renders as an annotation row on table nodes ([`webview/src/TableNode.tsx`](../webview/src/TableNode.tsx)).
  - Header toggle **Show column descriptions** (default on) in the webview
    ([`webview/src/App.tsx`](../webview/src/App.tsx)).
  - `leadingComments` not rendered in v1 — only inline trailing comments (see open decisions).
- **Phase 3 — add foreign key** (`P3-1`, `P3-8` partial, 2026-06-27):
  - Edit layer [`src/edits/`](../src/edits/): clone model, validate, emit candidate SQL.
  - Webview **Add FK** mode: pick source column → pick target PK → **Preview FK**.
  - Diff editor + **Apply** / **Discard** title actions ([`src/extension/diffPreview.ts`](../src/extension/diffPreview.ts)).
  - Headless checks: `npm run verify:p3`. Tables now store full `.sqlproj` include paths for
    file resolution ([`src/project.ts`](../src/project.ts)).
- **Phase 3 — add / remove column** (`P3-2`, 2026-06-27):
  - [`src/edits/addColumn.ts`](../src/edits/addColumn.ts) and
    [`src/edits/removeColumn.ts`](../src/edits/removeColumn.ts): insert before constraints (C5),
    PK/FK/inbound-FK guardrails on remove.
  - Webview **Add column** (table header → form → preview) and **Remove column** (column pick →
    preview) modes in [`webview/src/App.tsx`](../webview/src/App.tsx).
  - `npm run verify:p3` extended with add/remove column headless checks.
- **Phase 3 — edit pipeline refactor** (2026-06-27):
  - Shared flow: validate → clone → `apply*Mutation` →
    [`buildFileEditCandidate`](../src/edits/candidate.ts).
  - Shared checks in [`memberChecks.ts`](../src/edits/memberChecks.ts); FK naming in
    [`naming.ts`](../src/edits/naming.ts).
  - Host/webview protocol unified in [`src/protocol/`](../src/protocol/) (webview re-exports via
    [`webview/src/types.ts`](../webview/src/types.ts)).
  - Generic [`handlePrepareEdit`](../src/extension/erdPanel.ts) in the extension panel;
    grouped edit session state in the webview. All exit criteria still green.
- **Phase 3 — rename column** (`P3-3`, 2026-06-27):
  - [`src/edits/renameColumn.ts`](../src/edits/renameColumn.ts): rename in owning table;
    propagate to PK/unique/FK local columns, PERIOD bounds, and inbound `REFERENCES` across
    files. [`buildFileEditCandidates`](../src/edits/candidate.ts) for multi-file edits.
  - Webview **Rename column** mode: column pick → new name → preview; multi-file edits use
    sequential diff preview (`1/N`) in [`diffPreview.ts`](../src/extension/diffPreview.ts).
  - `EditValidationResult` now returns `candidates[]`; `npm run verify:p3` extended.

## In progress

- _None._ Next session starts **P3-4** (change column type / nullability).

## Next up (immediate — start here next session)

1. **P3-4** — change column type / nullability.
2. Pin the **exact canonical formatting rules** (`P0-15`).
3. Triage real-project coverage gaps (`P0-14`).

> Tip: `npm run spike`, `npm run verify:p1`, `npm run verify:p3`, `npm run typecheck`,
> `npm run compile`, then F5.
> In the Extension Development Host, **File → Open Folder** to the repo before **Open ERD**.

## Blocked / needs input

- _None._

## Real-world findings from the example project (feed into Phase 0)

- Bracket-quoted identifiers (`[dbo].[InvBuyer]`) are pervasive.
- `PRIMARY KEY CLUSTERED` with index options (`WITH (...)`, `ON [PRIMARY]`).
- Fully commented-out tables (`TierMatrix`) and commented-out columns/FKs exist —
  **decision: ignore them entirely** (no model entry, no ERD node, no diagnostic;
  convention C9).
- Unusual identifiers (e.g. `PorMasterHdr+`).
- `IDENTITY`, `DEFAULT(...)`, `COLLATE` clauses on columns.
- Two distinct styles: clean hand-written `pr_*` tables vs machine-exported Syspro mirror
  tables. **All relationships are declared as FK constraints in code; the tool never infers
  them** (C10 / ADR-0008). FK-less tables correctly show no edges.
- `ALTER TABLE` is not used for schema definition (confirms convention C1).
- FK targets not in the `.sqlproj` (e.g. `dbo.pr_tariff_code` referenced by
  `pr_procurement_item`) are omitted from the diagram — both endpoints must exist as nodes.

## Recently settled decisions

- **D1 — Formatting strategy:** lazy canonicalization ("format on touch"); untouched files
  never rewritten; bulk migration kept as a future, reviewed option
  ([ADR-0010](decisions/ADR-0010-formatting-strategy-lazy-canonicalization.md)).
- **D2 — Syspro mirror tables:** read-only, classified by explicit path config
  ([ADR-0011](decisions/ADR-0011-syspro-mirror-read-only.md)).
- **Parser approach:** hand-written recursive-descent + trivia-preserving tokenizer
  ([ADR-0009](decisions/ADR-0009-parser-recursive-descent.md)).
- **Allowlist scope:** temporal columns + `PERIOD` modeled; post-`GO` content is a
  non-excluding diagnostic ([ADR-0012](decisions/ADR-0012-allowlist-scope.md)).
- Earlier: relationships are FK-only (C10/ADR-0008); commented-out schema ignored (C9).

## Open decisions (tracked, not yet final)

- Exact canonical formatting rules (indent width, alignment, keyword casing, identifier
  bracketing policy) — flows from D1; spike uses a simple deterministic style for now.
- **`leadingComments` on the diagram** — deferred in Phase 2 v1; only `trailingComment`
  renders today. Revisit when table header/footer descriptions ship.
- Whether the layout sidecar is committed for every repo by default.
- Default classification rule for read-only mirror tables (glob vs explicit list).

## Real-project coverage gaps from the P0-13 smoke test (triage as P0-14)

- 760 build items → 96 tables parsed, 664 skipped: most skips are proc/view/function `.sql`
  files (no `CREATE TABLE`), correctly ignored.
- 9 "expected table name" errors come from stored-proc files that create `#temp` tables —
  not table files (C2); discovery should distinguish file roles rather than scan for any
  `CREATE TABLE`.
- ~597 warnings are dominated by post-`GO` content (indexes, extended properties) and a few
  extra column modifiers — inputs for finalizing the allowlist.

## Pointers

- Plan & phases → [`07-roadmap.md`](07-roadmap.md)
- Task list → [`backlog.md`](backlog.md)
- History → [`../CHANGELOG.md`](../CHANGELOG.md)
- Decisions → [`decisions/`](decisions/)
