# ADR-0007 — Edit-apply UX via diff preview

**Status:** Accepted

## Context

Edits made on the diagram are written back into `.sql` files. Users expect to review a
before/after and keep or discard, similar to AI edit flows. VS Code does not expose
Cursor's exact inline ghost-text keep/reject widget to extensions.

## Decision

Present every generated change as a **diff preview the user confirms or discards**, using
VS Code's native capabilities:

- **Primary:** open a diff editor via `vscode.diff(original, candidate)` (candidate served
  from a `TextDocumentContentProvider` virtual document) with **Apply** / **Discard**
  title actions.
- **Backstop:** applied edits go through `WorkspaceEdit`, landing on the undo stack and the
  Git Source Control diff — always recoverable/reviewable.
- **Multi-file edits:** optionally use the **Refactor Preview** panel
  (`WorkspaceEdit` + `needsConfirmation`) for per-change checkboxes.

## Rationale

- The diff editor most closely matches the "see the editable lines, keep or undo" mental
  model and is fully supported.
- The diffs stay minimal because of canonical formatting, member-order preservation, and
  comment-trivia reproduction
  ([ADR-0003](ADR-0003-opinionated-subset-and-canonical-format.md),
  [ADR-0006](ADR-0006-comment-trivia-model.md)) — so even though we regenerate whole files,
  only the truly changed lines appear.
- Git + undo provide a safety net even if a user skips the preview.

## Consequences

- We build the candidate content in memory and never mutate the model in place until the
  user confirms.
- Edits are introduced one operation at a time (add FK first), each wired through the same
  preview→apply pipeline ([`../06-edit-ux.md`](../06-edit-ux.md)).
- Concurrent on-disk changes between preview and apply trigger a recompute + re-prompt to
  avoid applying a stale edit.

## Alternatives considered

- **Reimplement an inline keep/reject overlay:** not available as a public extension API;
  high effort for little gain over the diff editor.
- **Apply silently and rely only on Git:** rejected as the default — users want an
  explicit confirm step.
