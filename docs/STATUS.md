# STATUS — project snapshot

> The single place to learn "where are we?". Keep this current. See the update routine in
> [`../AGENTS.md`](../AGENTS.md).

**Last updated:** 2026-06-25
**Current phase:** Phase 0 — Parser/emitter spike (not started)
**Overall state:** Design complete; test corpus in place; implementation not yet begun.

## Done

- Project scope, architecture, and tech stack defined ([`docs/`](.)).
- SQL conventions, comment model, and data model specified.
- Edit/apply UX and phased roadmap documented.
- 7 ADRs recorded for the key decisions.
- Project-management scaffolding in place (AGENTS.md, STATUS, backlog, CHANGELOG).
- **Test fixture corpus** curated from the example `OSConnectWeylandtsDB` project
  ([`test/fixtures/`](../test/fixtures/)) — clean extension tables, a Syspro mirror table,
  and edge cases (`P0-1`).
- **Synthetic `.sqlproj` entry point** ([`test/fixtures/SampleErd.sqlproj`](../test/fixtures/SampleErd.sqlproj))
  so discovery is tested from the project file, not a folder scan (`P0-1b`).

## In progress

- _Nothing actively in progress._

## Next up (immediate — start here next session)

1. **Decide D1 — formatting strategy** (highest priority; blocks clean-diff/bidirectional
   value). See roadmap risk R1. (`P0-10`)
2. Decide parser approach: hand-written recursive-descent vs Chevrotain (`P0-2`).
3. **Phase 0 spike** — stand up a TS/CLI harness: load `test/fixtures/SampleErd.sqlproj` →
   discover table files (`P0-12`) → parse (`P0-3`) → emit (`P0-4`) → re-parse, and prove the
   stable-fixed-point criterion incl. comments and C9/C10 (`P0-5`…`P0-11`).
4. Pin the canonical formatting rules (flows from D1).

> Tip for the next session: read this file, then `AGENTS.md`, then `docs/backlog.md`. The
> fixtures and synthetic project are ready; no external input is required to begin.

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

## Top open decisions for next session

- **D1 — Formatting strategy (highest priority):** how to avoid huge diffs when editing
  already-non-canonical files (canonicalize-only-edited vs preserve-existing vs bulk
  migration). See roadmap risk R1. Decide before building much.
- **D2 — Syspro mirror tables:** read-only, excluded, or editable? Leaning read-only.
- Settled: relationships are FK-only (C10/ADR-0008); commented-out schema ignored (C9).

## Open decisions (tracked, not yet final)

- Parser approach (recursive-descent vs Chevrotain).
- Exact canonical formatting rules (indentation, alignment, casing).
- Whether `leadingComments` render on the diagram or only `trailingComment`.
- Whether the layout sidecar is committed for every repo by default.

## Pointers

- Plan & phases → [`07-roadmap.md`](07-roadmap.md)
- Task list → [`backlog.md`](backlog.md)
- History → [`../CHANGELOG.md`](../CHANGELOG.md)
- Decisions → [`decisions/`](decisions/)
