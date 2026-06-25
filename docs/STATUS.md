# STATUS — project snapshot

> The single place to learn "where are we?". Keep this current. See the update routine in
> [`../AGENTS.md`](../AGENTS.md).

**Last updated:** 2026-06-25
**Current phase:** Phase 0 — Parser/emitter spike (exit criteria met)
**Overall state:** Phase 0 spike implemented and green on the fixture corpus; discovery
smoke-tested against the real 760-item project. Ready to start Phase 1.

## Done

- Project scope, architecture, and tech stack defined ([`docs/`](.)).
- SQL conventions, comment model, and data model specified.
- Edit/apply UX and phased roadmap documented.
- 11 ADRs recorded for the key decisions (ADR-0001…0012; 0009–0012 added this session).
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
  harness (`P0-5`). All exit criteria pass on the fixtures:
  - stable fixed point `emit(parse(emit(x))) === emit(parse(x))` on every fixture (`P0-6`);
  - all four comment slots + rule-5 fallback preserved (`P0-6`);
  - commented-out schema ignored — no table, node, or diagnostic (`P0-9` / C9);
  - edges only from declared FKs; commented-out FKs and FK-less tables produce none
    (`P0-11` / C10);
  - unsupported constructs raise loud diagnostics, no crashes (`P0-7`).
- **Discovery smoke test** (`P0-13`) against the real project (760 build items): 96 tables,
  125 FK edges, no crashes; coverage gaps captured for triage (see findings below).

## In progress

- _Nothing actively in progress._

## Next up (immediate — start here next session)

1. Pin the **exact canonical formatting rules** (indent width, alignment, casing, identifier
   bracketing policy) — the spike uses a simple deterministic style; finalize before P4-1.
2. Triage real-project coverage gaps surfaced by `P0-13` (`P0-14`): proc/view/function files
   (not table files), post-`GO` objects, and extra column modifiers.
3. Begin **Phase 1** — VS Code extension scaffold + read-only ERD (`P1-1`…).

> Tip for the next session: read this file, then `AGENTS.md`, then `docs/backlog.md`. Run the
> spike with `npm run spike` (fixtures) and `npm run spike:real` (discovery smoke test).

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
- Whether `leadingComments` render on the diagram or only `trailingComment`.
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
