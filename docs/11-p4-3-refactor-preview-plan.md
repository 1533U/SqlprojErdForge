# P4-3 — Refactor Preview / atomic multi-file apply (implementation plan)

**Status:** done (2026-06-27)

**Goal:** Close the `P3-8` partial gap — multi-candidate edits (rename table, rename column
with inbound FKs, add/drop table) preview and apply atomically instead of a sequential `1/N`
diff stepper.

## Problem

Phase 3 shipped sequential diff preview: each `FileEditCandidate` opened its own diff editor
with Apply/Discard, labeled `(1/N)`. Risks:

- User applies step 1 then abandons → orphan `.sqlproj` / layout vs missing `.sql` file.
- Rename table is delete-then-create on disk across two steps — window for inconsistent state.
- No single undo boundary for the whole edit.

## Decision

Per [`06-edit-ux.md`](06-edit-ux.md) option 3 and [ADR-0007](decisions/ADR-0007-edit-apply-ux.md):

| Candidates | Preview UX |
|---|---|
| 1 | Diff editor + Apply / Discard (unchanged) |
| 2+ | VS Code **Refactor Preview** — one `WorkspaceEdit` with `needsConfirmation: true` per change, `{ isRefactoring: true }` on apply |

Single-file ops (add FK, add/remove column, change column) keep the diff editor path.

## Pipeline

```
validate → clone → build candidates[] →
  if candidates.length === 1 → diff editor (option 1)
  else → validate batch revisions → WorkspaceEdit → Refactor Preview → atomic apply
```

## Rename table pairing

Rename table emits a delete candidate + create candidate for the `.sql` file. Batch apply uses
`WorkspaceEdit.renameFile(old, new)` plus a full-file replace on the new path — not separate
delete + create steps.

Candidates link via optional `renamePairKey` on both sides (`src/edits/types.ts`).

## Batch apply mapping

| Candidate flags | WorkspaceEdit |
|---|---|
| delete + create with same `renamePairKey` | `renameFile` + `replace` (new content) |
| `isNewFile` (standalone) | `createFile` with `contents` |
| `isDeleteFile` (standalone) | `deleteFile` |
| default | full-document `replace` |

Each entry carries `WorkspaceEditEntryMetadata`: `{ label, needsConfirmation: true }`.

## Key files

| File | Change |
|---|---|
| [`src/extension/diffPreview.ts`](../src/extension/diffPreview.ts) | batch path when `candidates.length > 1`; retire `PendingSequence` stepper |
| [`src/edits/batchCandidates.ts`](../src/edits/batchCandidates.ts) | revision validation, rename-pair grouping, edit labels (headless-testable) |
| [`src/edits/types.ts`](../src/edits/types.ts) | `renamePairKey?` on `FileEditCandidate` |
| [`src/edits/renameTable.ts`](../src/edits/renameTable.ts) | set `renamePairKey` on delete + create sql candidates |
| [`src/verify/p3/batchApply.ts`](../src/verify/p3/batchApply.ts) | batch validation + pairing checks |

## Verify (`npm run verify:p3`)

- Rename table delete/create share `renamePairKey`; batch validation passes on fixture model.
- Add table (3 candidates), drop table (3), rename column with inbound FK (2) — batch validation green.
- Stale revision detected when `originalRevision` tampered.

## Deferred (out of scope)

- `P4-4` — conflict handling beyond revision check at preview time.
- `P0-14b` — column-modifier allowlist.
- `P4-6` — Edit… dropdown for crowded toolbar.
- Pre-ticked Refactor Preview checkboxes (VS Code API limitation — user must confirm each group).

**Closes:** `P3-8` partial gap, `P4-3` backlog item.
