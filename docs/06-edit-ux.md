# 06 — Edit & Apply UX

How an edit made on the diagram becomes a reviewable change in the `.sql` files.

## The apply pipeline

```
diagram edit intent  →  mutate a copy of the model  →  canonical emit affected file(s)
        →  show diff preview (before/after)  →  user confirms or discards
        →  apply via WorkspaceEdit (undoable, Git-tracked)
```

The model is never mutated in place until the user confirms; the preview operates on a
candidate emit.

## Why the diff stays minimal

Even though an edit regenerates the **whole** affected file, the diff shows only the lines
that truly changed. That is a direct dividend of the format discipline in
[`03-sql-conventions.md`](03-sql-conventions.md):

- **Canonical formatting (C4)** → no spurious whitespace/casing churn.
- **Preserve member order (C5)** → nothing jumps around.
- **Comment trivia reproduced in place (04)** → comments aren't deleted/re-added.

Without these, every edit would diff as "entire file rewritten" and review would be
worthless. With them, "add a foreign key" shows as a couple of added lines.

## Review options in VS Code

VS Code does not expose Cursor's exact inline ghost-text keep/reject widget to extensions,
but it offers three ways to do "show before/after, then confirm," which we combine:

1. **Diff editor with Apply / Discard (primary).** Generate the candidate file content in
   memory, expose it via a `TextDocumentContentProvider` virtual document, and open
   `vscode.diff(original, candidate)`. Add editor-title actions **Apply** and **Discard**.
   This is the clearest before/after and matches the mental model of "see the editable
   lines, keep or undo."
2. **Git diff + undo (always-present safety net).** Applied changes land on the normal
   undo stack (Ctrl+Z) and, because `.sql` files are Git-tracked, also show in the Source
   Control panel. Even if a user skips the preview, the change is recoverable and
   reviewable in a PR.
3. **Refactor Preview panel (optional, multi-file edits).** Apply a `WorkspaceEdit` whose
   edits are marked `needsConfirmation: true`; VS Code shows its Refactor Preview tree
   with per-change checkboxes. Useful when an edit spans multiple tables/files (e.g. a
   rename that updates referencing FKs).

## Recommended default

- **Primary:** Option 1 (diff editor + Apply/Discard).
- **Backstop:** Option 2 (undo + Git) always available.
- **Add later:** Option 3 for multi-file edits.

## Supported edit operations (introduced incrementally)

**Shipped (2026-06-27):** add foreign key; add / remove column; rename column (with inbound FK
propagation); change column type / nullability; add table (new file + sqlproj + layout);
drop table (delete file + sqlproj + layout, inbound-FK warning); single-file diff preview
with Apply/Discard.
Multi-file rename uses sequential diff preview (`1/N`); full Refactor Preview panel deferred to Phase 4 (`P4-3`).

Edits are added one well-defined operation at a time, each = *mutate model → emit affected
file(s) → preview → apply*:

1. **Add foreign key** — **done** (`P3-1`).
2. **Add column** / **remove column** — **done** (`P3-2`).
3. **Rename column** (must update FK definitions that reference it; multi-file → sequential
   diff preview) — **done** (`P3-3`).
4. **Change column type / nullability** — **done** (`P3-4`).
5. **Add table** (creates a new `schema.table.sql` file + a layout entry) — **done** (`P3-5`).
6. **Drop table** (deletes the file; warn if other tables reference it) — **done** (`P3-6`).
7. **Rename table** (rename file, update referencing FKs, migrate the layout key).

## Edit invariants

- An edit only rewrites the file(s) it must; unrelated files are untouched.
- The emitter always produces canonical, order-preserving, comment-preserving output, so
  the preview diff is always reviewable.
- Multi-file edits (renames affecting FKs) are applied atomically via a single
  `WorkspaceEdit`.
- Layout entries are migrated/created/removed in lockstep with table add/rename/drop.

## Conflict & liveness handling

- If a `.sql` file changes on disk between preview generation and apply, the candidate is
  recomputed and the user is re-prompted rather than applying a stale edit.
- The `FileSystemWatcher` ignores the brief window of the tool's own writes to avoid a
  redundant re-parse loop.
