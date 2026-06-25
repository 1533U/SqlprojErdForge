# 07 — Roadmap & Project Plan

Phased plan from de-risking spike to bidirectional editing. Each phase has a clear exit
criterion so we never build UI on top of an unproven foundation.

## Phase 0 — Parser/emitter spike (de-risk first)

**Goal:** prove the bidirectional concept holds on our real files *before* touching any UI.

- Implement the parser for the supported subset ([`03-sql-conventions.md`](03-sql-conventions.md))
  into the model ([`05-data-model.md`](05-data-model.md)).
- Implement the canonical emitter (model → `.sql`), order- and comment-preserving.
- Build a small CLI/test harness: read files → parse → emit → re-parse.

**Exit criteria (must all pass):**
- `parse → emit → parse` is **byte-stable** (after one normalizing pass) on a corpus of
  our real project files.
- Stability holds on files exercising **all four comment slots** plus the rule-5 footer
  fallback ([`04-comment-model.md`](04-comment-model.md)).
- Unsupported constructs produce clear diagnostics, not crashes or silent drops.

> If Phase 0 fails, the bidirectional idea needs rethinking — better to learn it here than
> after building a UI.

## Phase 1 — Read-only live ERD

**Goal:** an accurate, auto-laid-out, live diagram.

- VS Code extension scaffold: command to open the ERD for a `.sqlproj`.
- Webview React app + React Flow rendering of tables, columns, PK/FK badges.
- ELK auto-layout for unpositioned tables.
- `FileSystemWatcher` → re-parse changed file → patch model → refresh diagram (debounced).
- Layout sidecar read/write (`.erdforge/layout.json`); persist dragged positions.
- Surface parse diagnostics in the Problems panel.

**Exit criteria:**
- Opening the command renders the correct ERD for a real project.
- Editing/saving a `.sql` file updates the diagram within ~1s.
- Dragging tables persists across reopen via the sidecar.

## Phase 2 — Column comments on the diagram

**Goal:** make comments visible, delivering the "show comments on the ERD" feature.

- Render `trailingComment` (and optionally `leadingComments`) as column descriptions
  (annotation row and/or hover tooltip).
- Toggle to show/hide descriptions.

**Exit criteria:** column/table comments are visible and stay in sync with file edits.

## Phase 3 — Bidirectional editing (one op at a time)

**Goal:** edit schema through the diagram with reviewable diffs
([`06-edit-ux.md`](06-edit-ux.md)).

Order of operations:
1. Add foreign key.
2. Add / remove column.
3. Rename column (multi-file FK updates).
4. Change column type / nullability.
5. Add table (new file + layout entry).
6. Drop table (delete file, warn on inbound FKs).
7. Rename table (rename file, update FKs, migrate layout key).

Each ships with the diff-preview Apply/Discard flow.

**Exit criteria (per op):** the resulting `.sql` diff is minimal, correct,
comment/order-preserving, and the project still builds to a DACPAC in CI.

## Phase 4 — Guardrails & polish

- Canonical formatter + CI format check (enforce C4/C5).
- Optional DACPAC build in CI as the correctness backstop.
- Refactor Preview for multi-file edits; conflict handling on concurrent file changes.
- Editing affordances: edit comment text on the diagram, reorder via explicit action, etc.

**Exit criteria:** CI enforces conventions; multi-file edits are safe and previewable.

## Risk register

| Risk | Mitigation | Phase |
|---|---|---|
| Round-trip not faithful | Idempotency spike before any UI | 0 |
| T-SQL surface area creeps | Allowlist + loud diagnostics; conventions doc | 0, ongoing |
| Comment drift | Trivia model + no-reorder rule + dedicated tests | 0 |
| Parser too lenient (silent misread) | Fail loudly; DACPAC build as backstop | 0, 4 |
| Diagram layout instability | Committed JSON sidecar keyed by identity | 1 |
| Stale edit applied after file changed | Recompute candidate + re-prompt on conflict | 3 |
| Multi-file rename inconsistency | Atomic `WorkspaceEdit` + Refactor Preview | 3, 4 |

## Open decisions (to confirm during Phase 0)

- Parser approach: hand-written recursive-descent vs Chevrotain grammar.
- Exact canonical formatting rules (indentation width, alignment, casing).
- Whether `leadingComments` also render on the diagram or only `trailingComment`.
- Whether the layout sidecar is committed by default for every team/repo.
