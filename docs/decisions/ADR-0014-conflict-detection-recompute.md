# ADR-0014 — Conflict detection & fail-closed recompute on concurrent file changes

**Status:** Accepted

**Settles:** open item **P4-4**; makes concrete the conflict clause in
[ADR-0007](ADR-0007-edit-apply-ux.md) ("Concurrent on-disk changes between preview and
apply trigger a recompute + re-prompt") and the risk-register row *"Stale edit applied
after file changed"* in [`../07-roadmap.md`](../07-roadmap.md).

## Context

Edits are previewed, then applied as a `WorkspaceEdit` ([ADR-0007](ADR-0007-edit-apply-ux.md)).
A `FileEditCandidate` captures a snapshot at preview time: `originalContent` and a
content hash `originalRevision` ([`../../src/edits/types.ts`](../../src/edits/types.ts)).
Between preview and apply the on-disk `.sql` can change — a teammate edit, a Git operation,
a watcher-driven model refresh, or an external tool — and applying the previewed candidate
would silently overwrite that newer content (data loss).

Detection existed but was uneven: the single-file diff-apply path recomputed the revision
inline, while the multi-file batch path used a separate `validateCandidateBatch`. The
single-file path had no headless coverage, and the UX only told users to "discard and
retry" rather than offering a recompute.

## Decision

**Detect conflicts by recomputing the content hash against current disk content at apply
time, and fail closed — never overwrite. Offer to recompute the preview.**

- **One shared detector** ([`../../src/edits/conflict.ts`](../../src/edits/conflict.ts)):
  `detectCandidateConflict` / `detectBatchConflict` return a `CandidateConflict`
  discriminated union (`none | fileChanged | fileMissing | fileAlreadyExists |
  fileAlreadyDeleted`). Both the single-file and batch apply paths use it; the batch
  `validateCandidateBatch` delegates to it.
- **Recompute against disk at apply time**, not just at preview time, for every candidate
  (replace, new-file, delete-file).
- **Fail closed:** any non-`none` conflict blocks the apply. The user sees a clear modal
  message and a **"Recompute preview"** action that rebuilds candidates from fresh
  disk/model and re-opens the preview. Declining leaves disk untouched.
- **Snapshots are self-contained:** a candidate carries its own `originalContent` /
  `originalRevision`, so a watcher-driven model refresh mid-edit cannot corrupt a pending
  preview; the apply-time recompute still catches any real on-disk change.

## Rationale

- Content-hash comparison is precise (catches any byte change) and cheap.
- A single detector removes drift between the two apply paths and is pure, so it is fully
  testable headlessly (`npm run verify:p4`) against real temp files rather than only
  through VS Code.
- "Recompute preview" matches the ADR-0007 mental model (review-then-apply) and guarantees
  no silent overwrite; Git + undo remain the backstop.

## Consequences

- A green gate **`npm run verify:p4`** ([`../../src/verify/p4/conflict.ts`](../../src/verify/p4/conflict.ts))
  proves fail-closed behaviour for each scenario: single-file apply after on-disk change,
  multi-file batch with one stale candidate, and a watcher refresh landing mid-edit. Added
  to CI ([`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml)).
- Conflicts are surfaced, never auto-merged. Three-way merge of concurrent edits is out of
  scope (a future ADR could revisit).
- New conflict kinds must extend the `CandidateConflict` union; the `conflictMessage`
  exhaustive `switch` makes any unhandled variant a compile error.

## Alternatives considered

- **Auto-merge / three-way merge:** rejected for now — high complexity, and the canonical
  whole-file regeneration makes line-level merge unreliable. Re-prompt is safer.
- **Last-writer-wins (apply anyway):** rejected — silent data loss, the exact risk this
  ADR mitigates.
- **Lock files during preview:** rejected — fragile across external editors and Git; does
  not survive process restarts.
