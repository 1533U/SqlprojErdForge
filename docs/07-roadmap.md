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
- `parse → emit → parse` reaches a **stable fixed point after one normalization pass** on
  the fixture corpus: the *first* emit may reformat an already-non-canonical file, but
  `emit(parse(emit(x)))` must be byte-identical to `emit(parse(x))` (idempotent thereafter),
  and the normalization diff must be reviewed as acceptable. (True byte-stability against
  the *original* messy files is not the bar — see risk register R1/R2.)
- The normalization diff on real files is **minimal and acceptable** — not a wholesale
  rewrite that would make review useless.
- Stability holds on files exercising **all four comment slots** plus the rule-5 footer
  fallback ([`04-comment-model.md`](04-comment-model.md)).
- Commented-out schema is ignored (no model entry, no node, no diagnostic; C9), and
  relationships come only from declared FKs (C10).
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

> **Status (2026-06-25):** complete — verified headlessly via `npm run verify:p1` on fixtures
> and the real OSConnectWeylandtsDB project (~96 tables, 105 in-project FK edges).

## Phase 2 — Column comments on the diagram

**Goal:** make comments visible, delivering the "show comments on the ERD" feature.

- Render `trailingComment` (and optionally `leadingComments`) as column descriptions
  (annotation row and/or hover tooltip).
- Toggle to show/hide descriptions.

**Exit criteria:** column/table comments are visible and stay in sync with file edits.

## Phase 3 — Bidirectional editing (one op at a time)

**Goal:** edit schema through the diagram with reviewable diffs
([`06-edit-ux.md`](06-edit-ux.md)).

**Progress (2026-06-27):** **Phase 3 complete.** All eight edit ops shipped; edit layer in
`src/edits/` with headless checks via `npm run verify:p3`. Multi-file edits use VS Code
Refactor Preview for atomic apply (`P4-3`).

Order of operations:
1. Add foreign key — **done** (`P3-1`).
2. Add / remove column — **done** (`P3-2`).
3. Rename column (multi-file FK updates) — **done** (`P3-3`).
4. Change column type / nullability — **done** (`P3-4`).
5. Add table (new file + layout entry) — **done** (`P3-5`).
6. Drop table (delete file, warn on inbound FKs) — **done** (`P3-6`).
7. Rename table (rename file, update FKs, migrate layout key) — **done** (`P3-7`).

Each ships with diff preview: single-file → diff editor + Apply/Discard; multi-file →
Refactor Preview (`P4-3`).

**Exit criteria (Phase 3):** met — all eight ops pass `npm run verify:p3`; host/webview/protocol
registry in sync; per-op validate → clone → mutate → candidates pipeline.

## Phase 4 — Guardrails & polish

- Canonical formatter + CI format check (enforce C4/C5) — **done** (`P4-1`).
- Optional DACPAC build in CI as the correctness backstop — **done** (`P4-2`).
- Refactor Preview for multi-file edits — **done** (`P4-3`).
- Conflict handling on concurrent file changes — **done** (`P4-4`); fail-closed content-hash
  detection + Recompute preview ([ADR-0014](decisions/ADR-0014-conflict-detection-recompute.md)).
- Editing affordances: edit comment text on the diagram — **done** (`P4-5`); grouped edit
  toolbar menu — **done** (`P4-6`). Further affordances (reorder via explicit action, etc.)
  remain optional.

**Exit criteria:** CI enforces conventions; multi-file edits are safe and previewable.

## Risk register

| ID | Risk | Mitigation | Phase |
|---|---|---|---|
| R1 | **Canonical format vs real files** — existing files are not canonically formatted and are inconsistent (bracketed/unbracketed, mixed indent, two styles); reformatting on first edit could produce huge diffs, defeating C4's clean-diff goal | Decide a formatting strategy (D1 below): canonicalize-only-edited-tables, or "preserve existing formatting" instead of imposing one style, or a one-time bulk format migration. Validate on fixtures in Phase 0 | 0 |
| R2 | **Idempotency bar unrealistic on messy input** — true byte-stability vs original files is impossible | Reframed exit criterion: stable fixed point after one normalization pass + acceptable minimal diff (done, see Phase 0) | 0 |
| R3 | **Syspro mirror tables** — machine-exported, no FKs; editing them would be clobbered on next ERP export | Decide scope (D2 below): likely read-only or excluded; focus editing on `pr_*` extension schemas | 0/1 |
| R4 | **Parser effort underestimated** — types, `DEFAULT`/`COLLATE`/`IDENTITY`/computed columns, bracket handling add up | Treat the size estimate as a hypothesis; let the Phase 0 spike measure real effort | 0 |
| | Round-trip not faithful | Idempotency spike before any UI | 0 |
| | T-SQL surface area creeps | Allowlist + loud diagnostics; conventions doc | 0, ongoing |
| | Comment drift | Trivia model + no-reorder rule + dedicated tests | 0 |
| | Parser too lenient (silent misread) | Fail loudly; DACPAC build as backstop | 0, 4 |
| | Diagram layout instability | Committed JSON sidecar keyed by identity | 1 |
| | Stale edit applied after file changed | Recompute candidate + re-prompt on conflict — **done** (`P4-4`, ADR-0014); `npm run verify:p4` | 3, 4 |
| | Multi-file rename inconsistency | Atomic `WorkspaceEdit` + Refactor Preview | 3, 4 |

> Note: ERD relationships are **declared FKs only, never inferred** (convention C10 /
> [ADR-0008](decisions/ADR-0008-fk-only-relationships.md)). A sparse diagram for FK-less
> tables is correct behavior, not a risk to mitigate.

## Open decisions (to confirm during Phase 0)

- **D1 — Formatting strategy (highest priority; addresses R1):** canonicalize only the
  tables we edit, vs "preserve existing formatting" rather than imposing a canonical style,
  vs a one-time bulk format migration. This is the hinge the clean-diff/bidirectional value
  depends on — decide first.
- **D2 — Syspro mirror tables (addresses R3):** treat as read-only, exclude entirely, or
  allow editing? Leaning read-only/excluded.
- Parser approach: hand-written recursive-descent vs Chevrotain grammar.
- ~~Exact canonical formatting rules~~ — settled in C4.1–C4.8 / [ADR-0013](decisions/ADR-0013-canonical-format-rules.md) (`P0-15`).
- Whether `leadingComments` also render on the diagram or only `trailingComment`.
- Whether the layout sidecar is committed by default for every team/repo.

## Settled decisions (do not revisit without a new ADR)

- Relationships are derived **only** from declared FK constraints; never inferred
  (C10 / [ADR-0008](decisions/ADR-0008-fk-only-relationships.md)).
- Commented-out schema is ignored entirely (C9).
