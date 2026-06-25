# 04 — Comment Model

Comments are **first-class data**, not throwaway whitespace. They are captured during
parsing as *trivia*, attached to a stable anchor, and re-emitted in canonical positions so
they survive a `parse → emit → parse` round-trip.

This is the same "trivia attachment" technique formatters like Prettier use: a comment is
anchored to the nearest stable node, not to a byte offset, so it stays correct even after
the file is regenerated.

## Members

A table body is an **ordered list of members**, where a member is **either a column or a
constraint**. Comments attach to members uniformly — constraints behave exactly like
columns.

## The four (and only four) comment slots

| Slot | Source form | Attaches to | Shown on ERD |
|---|---|---|---|
| **Member trailing** | inline `-- …` at the end of a column/constraint line | that member | **Yes** — as the member's description |
| **Member leading** | standalone comment line(s) directly above a member | the **next member below** | optional (same field) |
| **Table header** | comment(s) above `CREATE TABLE` | the table, emitted above | as table description |
| **Table footer** | comment(s) below the table, or at the end of the body with no member below | the table, emitted below | as table description |

There are **no free-floating in-body comments**. Every comment inside the body either is
inline on a member, leads the next member, or (if nothing follows it) becomes a footer
comment.

## Resolution rules (deterministic)

1. **Inline on a member line** → `member.trailingComment`. Shown on the ERD as that
   member's description.
2. **Standalone comment(s) inside the body** → `leadingComments` of the **next member
   below** (column or constraint alike).
3. **Comment(s) above `CREATE TABLE`** → `table.headerComments`.
4. **Comment(s) below the table** → `table.footerComments`.
5. **Comment in the body with no member below it** (e.g. after the last column, before the
   closing `)`) → **footer comment**. This is the agreed fallback; such comments are not
   dropped, they migrate to the footer.

## Emission rules

- For each member, in source order: print its `leadingComments`, then the member, then its
  `trailingComment`.
- `headerComments` are printed above `CREATE TABLE`; `footerComments` below the table.
- A header/footer comment is **always re-emitted on the same side (above/below) it
  originated** — header stays header, footer stays footer.
- Because members are never reordered (convention C5), leading-comment attachment stays
  stable across round-trips.

## Worked example

Input:

```sql
-- Customer master record          <-- header
CREATE TABLE dbo.Customer (
    Id     INT           NOT NULL,  -- surrogate key            <-- trailing → Id
    -- display name shown in the UI                              <-- leading → Name
    Name   NVARCHAR(100) NOT NULL,
    Email  NVARCHAR(256) NULL,      -- nullable until verified   <-- trailing → Email
    CONSTRAINT PK_Customer PRIMARY KEY (Id)
    -- audit columns still TODO                                  <-- no member below → footer
);
-- Owned by the Accounts team       <-- footer
```

Parsed attachment:

- `headerComments`: `["Customer master record"]`
- `Id.trailingComment`: `"surrogate key"`
- `Name.leadingComments`: `["display name shown in the UI"]`
- `Email.trailingComment`: `"nullable until verified"`
- `footerComments`: `["audit columns still TODO", "Owned by the Accounts team"]`

`emit` reproduces all of the above in the same slots, so re-parsing yields the identical
attachment — round-trip stable.

## ERD feature: column comments as descriptions

Because `trailingComment` (and optionally `leadingComments`) are part of the model, the
diagram can display them as the column's description — e.g. a subtle annotation row or a
tooltip on hover. This is essentially free once trivia is first-class and is a planned
feature (see [`07-roadmap.md`](07-roadmap.md)).

## Testing requirement

The Phase 0 idempotency spike must verify **byte stability** (after one normalizing pass)
on files exercising all four slots **plus** the rule-5 fallback. If comments survive the
round-trip, the hardest part of bidirectional editing is proven.
