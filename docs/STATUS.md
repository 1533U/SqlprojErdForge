# STATUS — project snapshot

> The single place to learn "where are we?". Keep this current. See the update routine in
> [`../AGENTS.md`](../AGENTS.md).

**Last updated:** 2026-06-28
**Current phase:** Phase 4 — guardrails (`P4-1`, `P4-2`, `P0-14a`, `P4-3`, **`P4-4`** done);
remaining: optional **`P4-5`**, **`P4-6`**, **`P0-14b`**
**Overall state:** Phase 0–2 complete. **Phase 3 complete.** **Phase 4 guardrails:** format
conformance (`P4-1`), file-role discovery filter (`P0-14a`), DACPAC CI backstop on fixtures
(`P4-2`), **atomic multi-file Refactor Preview** (`P4-3` — closes `P3-8` partial gap),
**conflict handling on concurrent file changes** (`P4-4`). Remaining Phase 4 items are
optional polish: edit comment text (`P4-5`), toolbar grouping (`P4-6`), allowlist triage
(`P0-14b`).

## Done

- Project scope, architecture, and tech stack defined ([`docs/`](.)).
- SQL conventions, comment model, and data model specified.
- Edit/apply UX and phased roadmap documented.
- 14 ADRs recorded for the key decisions (ADR-0001…0014).
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
- **Phase 1 exit criteria verified** (`npm run verify:p1`, 2026-06-25, updated 2026-06-27):
  - Real project ERD: 96 tables, 105 in-project FK edges (20 dangling omitted), ELK layout
    for all tables in ~750 ms; **597 diagnostics, 0 errors** (after P0-14a file-role filter).
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
    Refactor Preview ([`diffPreview.ts`](../src/extension/diffPreview.ts), `P4-3`).
  - `EditValidationResult` now returns `candidates[]`; `npm run verify:p3` extended.
- **Phase 3 — change column type / nullability** (`P3-4`, 2026-06-27):
  - [`src/edits/changeColumn.ts`](../src/edits/changeColumn.ts): update `dataType` and
    `nullable` on one column; guardrails for IDENTITY, computed/temporal, PERIOD, and PK
    nullability via [`columnTypeChangeBlockReason`](../src/edits/memberChecks.ts).
  - Webview **Change column** mode: column pick → type/nullable form → preview.
  - Registered as fifth op in [`src/edits/registry.ts`](../src/edits/registry.ts);
    `npm run verify:p3` extended.
- **Phase 3 — add table** (`P3-5`, 2026-06-27):
  - [`src/edits/addTable.ts`](../src/edits/addTable.ts): canonical CREATE TABLE for a new table
    (identity PK column), `.sqlproj` `<Build Include>` insertion
    ([`src/edits/sqlprojEdit.ts`](../src/edits/sqlprojEdit.ts)), and `.erdforge/layout.json`
    entry in lockstep.
  - First file-creating edit: `FileEditCandidate.isNewFile` + diff-preview apply creates files
    on disk ([`src/extension/diffPreview.ts`](../src/extension/diffPreview.ts)).
  - Webview **Add table** mode: schema + table name form → Refactor Preview (sql →
    sqlproj → layout).
  - Registered as sixth op in [`src/edits/registry.ts`](../src/edits/registry.ts);
    `npm run verify:p3` extended.
- **Phase 3 — drop table** (`P3-6`, 2026-06-27):
  - [`src/edits/dropTable.ts`](../src/edits/dropTable.ts): delete `.sql` file, remove `.sqlproj`
    `<Build Include>` ([`removeBuildInclude`](../src/edits/sqlprojEdit.ts)), and strip layout
    entry ([`removeLayoutEntry`](../src/layout.ts)) in lockstep.
  - `FileEditCandidate.isDeleteFile` + diff-preview apply path for file deletion.
  - Webview **Drop table** mode: table header pick → inbound-FK warning → Refactor Preview.
  - Registered as seventh op; `npm run verify:p3` extended. Plan:
    [`docs/09-p3-6-drop-table-plan.md`](09-p3-6-drop-table-plan.md).
- **Phase 3 — rename table** (`P3-7`, 2026-06-27):
  - [`src/edits/renameTable.ts`](../src/edits/renameTable.ts): rename `.sql` file
    (`schema.table.sql`), update `.sqlproj` `<Build Include>` ([`replaceBuildInclude`](../src/edits/sqlprojEdit.ts)),
    migrate layout key ([`migrateLayoutEntry`](../src/layout.ts)), and propagate inbound
    `REFERENCES` across files.
  - Webview **Rename table** mode: table header pick → schema + new name form → Refactor
    Preview (rename file → inbound FK updates → sqlproj → layout).
  - Registered as eighth op; `npm run verify:p3` extended.
- **Phase 3 close-out** (2026-06-27): edit-pipeline audit green; `includeAbsPath` consolidated
  in `src/edits/paths.ts`; inbound-FK lookup deduped; constraint names intentionally unchanged
  on rename table (same as rename column); multi-file apply via Refactor Preview (`P4-3`).
- **Phase 4 — canonical format rules** (`P0-15`, 2026-06-27):
  - Pinned C4.1–C4.8 in [`docs/03-sql-conventions.md`](03-sql-conventions.md) (4-space indent,
    trailing commas, uppercase keywords, unbracketed simple identifiers, no alignment).
  - [ADR-0013](decisions/ADR-0013-canonical-format-rules.md): emitter is reference implementation;
    `P4-1` formatter must match byte-for-byte.
- **Phase 4 — canonical format check** (`P4-1`, 2026-06-27):
  - Conformance gate: on-disk `.sql` must equal `emit(parse(src))` byte-for-byte
    ([`src/formatCheck.ts`](../src/formatCheck.ts)).
  - Headless machinery tests: `npm run verify:format`; changed-file gate: `npm run format:check`
    (scoped per [ADR-0010](decisions/ADR-0010-formatting-strategy-lazy-canonicalization.md)).
  - GitHub Actions workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): typecheck,
    compile, spike, verify:p1/p3/format/p014, format:check on changed `.sql` only.
- **Phase 0 / 4 — real-project coverage triage** (`P0-14`, 2026-06-27):
  - Triage doc [`10-p0-14-coverage-triage.md`](10-p0-14-coverage-triage.md): 9 proc-file false
    errors eliminated; 597 warnings remain (591 unsupported column modifiers).
  - **P0-14a:** file-role detection in [`src/sqlFileRole.ts`](../src/sqlFileRole.ts) — skip
    proc/view/function `.sql` before table parse; `npm run verify:p014`.
  - Fixture: [`test/fixtures/edge/dbo.SampleProc.sql`](../test/fixtures/edge/dbo.SampleProc.sql).
- **Phase 4 — DACPAC CI backstop** (`P4-2`, 2026-06-27):
  - Separate GitHub Actions `dacpac` job: `dotnet build test/fixtures/SampleErd.sqlproj`.
  - `npm run verify:dacpac` (skips locally when dotnet absent). **Not a runtime dependency**
    — VS Code extension remains standalone ([ADR-0002](decisions/ADR-0002-pure-typescript-parser.md)).
  - Fixture sqlproj uses `Microsoft.Build.Sql` SDK.
- **Phase 4 — Refactor Preview / atomic multi-file apply** (`P4-3`, 2026-06-27):
  - Multi-candidate edits (rename table, rename column w/ inbound FKs, add/drop table) use
    VS Code **Refactor Preview** — one `WorkspaceEdit` with `needsConfirmation: true` per
    change ([`src/extension/diffPreview.ts`](../src/extension/diffPreview.ts)).
  - Single-file edits keep diff editor + Apply/Discard. Rename table delete+create paired via
    `renamePairKey` → atomic `renameFile` + content replace
    ([`src/edits/batchCandidates.ts`](../src/edits/batchCandidates.ts)).
  - Retired sequential `1/N` diff stepper. Plan: [`11-p4-3-refactor-preview-plan.md`](11-p4-3-refactor-preview-plan.md).
  - `npm run verify:p3` extended with batch validation checks.
- **Phase 4 — conflict handling on concurrent file changes** (`P4-4`, 2026-06-28):
  - Shared, pure detector [`src/edits/conflict.ts`](../src/edits/conflict.ts): `CandidateConflict`
    union + `detectCandidateConflict` / `detectBatchConflict` recompute the content hash against
    current disk content at **apply time** (not just preview). Single-file
    ([`diffPreview.ts`](../src/extension/diffPreview.ts)) and batch
    (`validateCandidateBatch` in [`batchCandidates.ts`](../src/edits/batchCandidates.ts)) paths
    both use it.
  - **Fail closed:** any conflict blocks the apply (no overwrite) and offers a **Recompute
    preview** modal action that rebuilds from fresh disk/model
    ([`erdPanel.ts`](../src/extension/erdPanel.ts)). Per [ADR-0014](decisions/ADR-0014-conflict-detection-recompute.md).
  - Green gate **`npm run verify:p4`** ([`src/verify/p4/conflict.ts`](../src/verify/p4/conflict.ts)):
    real temp-file checks prove fail-closed for scenarios (a) single-file change, (b) stale
    batch member, (c) watcher refresh mid-edit. Added to CI.
- **Health check + refactor** (2026-06-28): all gates green
  (`typecheck`, `compile`, `spike`, `verify:p1/p3/p014/format`). Two behavior-preserving
  slices give the edit-op set a single source of truth:
  - **Slice 10** — generic edit dispatch: [`src/extension/editDispatch.ts`](../src/extension/editDispatch.ts)
    derives the message-type set from the registry and collapses the eight-case switch.
  - **Slice 11** — `EditIntentMap`/`EditOperationId` moved to [`src/edits/types.ts`](../src/edits/types.ts);
    [`src/protocol/messages.ts`](../src/protocol/messages.ts) derives the wire edit variants from it
    and guards them with a compile-enforced `Record<EditOperationId, true>`.

  Also restored the missing Phase 2 heading in [`07-roadmap.md`](07-roadmap.md).

## In progress

- _None._ Phase 4 guardrails complete; remaining Phase 4 items are optional polish.

## Next up (immediate — start here next session)

1. **P4-5** (optional) — edit comment text on the diagram.
2. **P4-6** (optional polish) — group crowded webview edit toolbar (Edit… menu).
3. **P0-14b** (optional) — column-modifier allowlist triage on real project (~591 warnings).

> Tip: `npm run spike`, `npm run verify:p1`, `npm run verify:p3`, `npm run verify:p4`,
> `npm run verify:p014`, `npm run verify:format`, `npm run format:check`,
> `npm run typecheck`, `npm run compile`, then F5.
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

- **`leadingComments` on the diagram** — deferred in Phase 2 v1; only `trailingComment`
  renders today. Revisit when table header/footer descriptions ship.
- Whether the layout sidecar is committed for every repo by default.
- Default classification rule for read-only mirror tables (glob vs explicit list).
- **Constraint names on rename table/column** — intentionally preserved (e.g.
  `PK_pr_shipping_type` stays after renaming to `pr_shipment_type`). Only table/column
  identifiers and `REFERENCES` targets update. Optional rename-constraint op deferred.
- **Multi-file Refactor Preview (`P4-3`)** — **done.** Multi-candidate edits apply atomically
  via VS Code Refactor Preview; rename table uses `renameFile` pairing. Single-file diff
  preview unchanged.
- **Webview header crowding** — eight edit buttons in the toolbar; consider an **Edit…**
  dropdown/menu (`P4-6` in backlog). Not blocking Phase 4.

## Real-project coverage gaps from the P0-13 smoke test (triage as P0-14)

- 760 build items → 96 tables parsed, 664 skipped: most skips are proc/view/function `.sql`
  files (no top-level `CREATE TABLE`), correctly ignored via file-role detection (`P0-14a`).
- ~~9 "expected table name" errors~~ — **fixed** (proc `#temp` tables no longer parsed as table files).
- ~597 warnings: **591** unsupported column modifiers + **6** post-`GO` content (ADR-0012).
  See [`10-p0-14-coverage-triage.md`](10-p0-14-coverage-triage.md); optional allowlist work → `P0-14b`.

## Pointers

- Plan & phases → [`07-roadmap.md`](07-roadmap.md)
- Task list → [`backlog.md`](backlog.md)
- History → [`../CHANGELOG.md`](../CHANGELOG.md)
- Decisions → [`decisions/`](decisions/)
