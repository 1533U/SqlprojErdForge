# Backlog

Granular task list grouped by roadmap phase. Update statuses here as part of the
"document progress" routine ([`../AGENTS.md`](../AGENTS.md)).

**Status legend:** `todo` · `doing` · `done` · `blocked` · `dropped`

## Phase 0 — Parser/emitter spike

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P0-1 | Collect a corpus of real `.sql` files for tests | done | curated set in `test/fixtures/` from OSConnectWeylandtsDB |
| P0-1b | Add synthetic `.sqlproj` entry point referencing fixtures | done | `test/fixtures/SampleErd.sqlproj` |
| P0-12 | Project loader: parse `.sqlproj` XML, normalize backslash paths, filter to table files | todo | entry point is the project file, not a folder scan |
| P0-13 | Discovery integration smoke test against the real ~807-item project | todo | read-only, external path |
| P0-2 | Choose parser approach (recursive-descent vs Chevrotain) | todo | open decision |
| P0-8 | Handle real-world syntax: bracket identifiers, CLUSTERED PK + index options, IDENTITY/DEFAULT/COLLATE | todo | surfaced from fixtures |
| P0-9 | Ignore commented-out schema (no model entry, no ERD node, no diagnostic) | todo | convention C9; e.g. TierMatrix, commented-out FKs in pr_procurement_item |
| P0-10 | Decide formatting strategy (D1) to avoid huge diffs on non-canonical files | todo | risk R1; highest priority, decide first |
| P0-11 | Build ERD edges from declared FKs only (no inference) | todo | convention C10 / ADR-0008 |
| D2 | Decide Syspro mirror table scope (read-only / excluded / editable) | todo | risk R3; leaning read-only |
| P0-3 | Implement parser for the supported subset → model | todo | per `03`/`05` |
| P0-4 | Implement canonical emitter (model → `.sql`) | todo | order- & comment-preserving |
| P0-5 | CLI/test harness: parse → emit → parse | todo | |
| P0-6 | Idempotency tests incl. all 4 comment slots + footer fallback | todo | exit criterion |
| P0-7 | Diagnostics for unsupported constructs | todo | fail loudly |

## Phase 1 — Read-only live ERD

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P1-1 | VS Code extension scaffold + "open ERD" command | todo | |
| P1-2 | Webview React app + React Flow rendering | todo | |
| P1-3 | ELK auto-layout for unpositioned tables | todo | |
| P1-4 | FileSystemWatcher → re-parse → refresh (debounced) | todo | |
| P1-5 | Layout sidecar read/write (`.erdforge/layout.json`) | todo | |
| P1-6 | Surface diagnostics in Problems panel | todo | |

## Phase 2 — Column comments on the diagram

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P2-1 | Render trailing/leading comments as descriptions | todo | |
| P2-2 | Toggle to show/hide descriptions | todo | |

## Phase 3 — Bidirectional editing

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P3-1 | Add foreign key | todo | first op |
| P3-2 | Add / remove column | todo | |
| P3-3 | Rename column (multi-file FK updates) | todo | |
| P3-4 | Change column type / nullability | todo | |
| P3-5 | Add table (new file + layout entry) | todo | |
| P3-6 | Drop table (delete file, warn on inbound FKs) | todo | |
| P3-7 | Rename table (file + FKs + layout key migration) | todo | |
| P3-8 | Diff-preview Apply/Discard pipeline | todo | per `06` |

## Phase 4 — Guardrails & polish

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P4-1 | Canonical formatter + CI format check | todo | enforce C4/C5 |
| P4-2 | DACPAC build in CI (correctness backstop) | todo | |
| P4-3 | Refactor Preview for multi-file edits | todo | |
| P4-4 | Conflict handling on concurrent file changes | todo | |
| P4-5 | Edit comment text on the diagram | todo | |
