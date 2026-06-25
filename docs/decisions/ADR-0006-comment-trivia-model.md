# ADR-0006 — Comment trivia model (four slots)

**Status:** Accepted

## Context

Comments must be preserved across `parse → emit → parse`. The team's comment usage maps to
a small set of placements; there are no free-floating in-body comments.

## Decision

Treat comments as **first-class trivia** attached to stable anchors, using exactly **four
slots**:

1. **Member trailing** — inline `-- …` on a column/constraint line → that member
   (`trailingComment`); shown on the ERD as the member's description.
2. **Member leading** — standalone comment(s) above a member → the **next member below**
   (`leadingComments`).
3. **Table header** — comment(s) above `CREATE TABLE` → emitted above.
4. **Table footer** — comment(s) below the table, **and** any body comment with no member
   below it (fallback) → emitted below.

Columns and constraints are treated uniformly as **members**. Full spec in
[`../04-comment-model.md`](../04-comment-model.md).

## Rationale

- Anchoring comments to nodes (not byte offsets) lets them survive whole-file regeneration
  — the standard formatter technique (e.g. Prettier).
- Restricting to four slots with no floating body comments removes the need for
  member-relative anchoring of interleaved comments, collapsing the model to four simple
  fields.
- Inline column comments as first-class data directly enable the "show comments on the
  ERD" feature for free.

## Consequences

- Depends on **member order preservation** (C5 /
  [ADR-0003](ADR-0003-opinionated-subset-and-canonical-format.md)): "next member below"
  attachment is only stable if members never move.
- The Phase 0 idempotency spike must test all four slots plus the footer fallback for
  byte stability.
- Free-floating body comments are unsupported by convention; a body comment with no
  following member migrates to the footer rather than being dropped.

## Alternatives considered

- **Discard comments / regenerate from AST only:** rejected — destroys author intent and
  makes diffs hostile.
- **Byte-offset surgical edits to preserve arbitrary comments:** rejected — fragile;
  unnecessary given canonical formatting + constrained placement.
