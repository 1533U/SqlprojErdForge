# Backlog

Granular task list grouped by roadmap phase. Update statuses here as part of the
"document progress" routine ([`../AGENTS.md`](../AGENTS.md)).

**Status legend:** `todo` · `doing` · `done` · `blocked` · `dropped`

## Phase 0 — Parser/emitter spike

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P0-1 | Collect a corpus of real `.sql` files for tests | done | curated set in `test/fixtures/` from OSConnectWeylandtsDB |
| P0-1b | Add synthetic `.sqlproj` entry point referencing fixtures | done | `test/fixtures/SampleErd.sqlproj` |
| P0-1c | Add comment-slots fixture (4 slots + rule-5 fallback) | done | `test/fixtures/comments/dbo.CommentSlots.sql` |
| P0-12 | Project loader: parse `.sqlproj` XML, normalize backslash paths, filter to table files | done | `src/project.ts`; entry point is the project file |
| P0-13 | Discovery integration smoke test against the real ~760-item project | done | `npm run spike:real`; 96 tables, 125 edges, no crashes |
| P0-2 | Choose parser approach (recursive-descent vs Chevrotain) | done | recursive-descent — ADR-0009 |
| P0-8 | Handle real-world syntax: bracket identifiers, CLUSTERED PK + index options, IDENTITY/DEFAULT/COLLATE, temporal/PERIOD | done | `src/tokenizer.ts`/`src/parser.ts`; temporal added per ADR-0012 |
| P0-9 | Ignore commented-out schema (no model entry, no ERD node, no diagnostic) | done | C9; verified on TierMatrix + commented FKs/columns |
| P0-10 | Decide formatting strategy (D1) to avoid huge diffs on non-canonical files | done | lazy canonicalization — ADR-0010 |
| P0-11 | Build ERD edges from declared FKs only (no inference) | done | `src/erd.ts`; C10 / ADR-0008 |
| D2 | Decide Syspro mirror table scope (read-only / excluded / editable) | done | read-only — ADR-0011 |
| P0-3 | Implement parser for the supported subset → model | done | `src/parser.ts` per `03`/`05` |
| P0-4 | Implement canonical emitter (model → `.sql`) | done | `src/emitter.ts`; order- & comment-preserving |
| P0-5 | CLI/test harness: parse → emit → parse | done | `src/cli.ts` (`npm run spike`) |
| P0-6 | Idempotency tests incl. all 4 comment slots + footer fallback | done | fixed point green on full corpus |
| P0-7 | Diagnostics for unsupported constructs | done | loud diagnostics; no crashes |
| P0-14 | Triage real-project coverage gaps (proc/view files, post-`GO` objects, extra modifiers) | done | triage doc `10-p0-14-coverage-triage.md`; P0-14a shipped |
| P0-14b | Column-modifier allowlist triage + top-N parser fixes | todo | ~591 warnings on real project; see triage doc |
| P0-15 | Pin exact canonical formatting rules (indent/alignment/casing/bracketing) | done | C4.1–C4.8 in `03-sql-conventions.md`; ADR-0013 |

## Phase 1 — Read-only live ERD

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P1-1 | VS Code extension scaffold + "open ERD" command | done | F5 verified; entry `out/extension.cjs` |
| P1-2 | Webview React app + React Flow rendering | done | table nodes + Handle-based FK edge lines |
| P1-3 | ELK auto-layout for unpositioned tables | done | edges filtered to in-project tables; grid fallback |
| P1-4 | FileSystemWatcher → re-parse → refresh (debounced) | done | 500 ms debounce; verified via `npm run verify:p1` |
| P1-5 | Layout sidecar read/write (`.erdforge/layout.json`) | done | fixture layout committed; drag-to-persist verified |
| P1-6 | Surface diagnostics in Problems panel | done | `ErdForge` diagnostic source; 606 diags on real project |
| P1-7 | Phase 1 exit-criteria verification (real project + live refresh) | done | `npm run verify:p1`; real project ~750 ms, refresh <1 s |

## Phase 2 — Column comments on the diagram

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P2-1 | Render trailing comments as column descriptions | done | `trailingComment` → `GraphColumn.description`; `leadingComments` deferred |
| P2-2 | Toggle to show/hide descriptions | done | header checkbox in webview; default on |

## Phase 3 — Bidirectional editing

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P3-1 | Add foreign key | done | webview two-click connect → diff preview → apply |
| P3-2 | Add / remove column | done | webview Add/Remove column modes; PK/FK guardrails on remove |
| P3-3 | Rename column (multi-file FK updates) | done | propagates to inbound REFERENCES; Refactor Preview |
| P3-4 | Change column type / nullability | done | webview Change column mode; IDENTITY/temporal/PK guardrails |
| P3-5 | Add table (new file + layout entry) | done | webview Add table mode; sqlproj + layout in lockstep |
| P3-6 | Drop table (delete file, warn on inbound FKs) | done | webview Drop table mode; sqlproj + layout in lockstep |
| P3-7 | Rename table (file + FKs + layout key migration) | done | eighth edit op; Refactor Preview |
| P3-8 | Diff-preview Apply/Discard pipeline | done | single-file diff editor; multi-file → Refactor Preview (`P4-3`) |

**Phase 3 exit:** all eight ops registered, wired host/webview/protocol, `npm run verify:p3` green.

## Phase 4 — Guardrails & polish

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P0-15 | Pin exact canonical formatting rules (indent/alignment/casing/bracketing) | done | C4.1–C4.8; ADR-0013 |
| P4-1 | Canonical formatter + CI format check | done | `src/formatCheck.ts`; `npm run format:check` + `verify:format`; CI on changed `.sql` |
| P4-2 | DACPAC build in CI (correctness backstop) | done | CI `dacpac` job; `verify:dacpac`; fixture SDK; CI-only per ADR-0002 |
| P4-3 | Refactor Preview for multi-file edits | done | atomic apply; rename table `renamePairKey` pairing; plan `11-p4-3-refactor-preview-plan.md` |
| P4-4 | Conflict handling on concurrent file changes | todo | |
| P4-5 | Edit comment text on the diagram | todo | |
| P4-6 | Group webview edit toolbar (Edit… menu) | todo | eight header buttons today |
