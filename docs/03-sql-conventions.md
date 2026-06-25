# 03 — SQL Conventions (the opinionated contract)

These conventions are the foundation of the whole project. Leaning on them is what makes
a pure-TypeScript parser, reliable round-tripping, and clean review diffs achievable
instead of having to solve the fully general T-SQL problem.

> The team already follows these conventions. This document makes them explicit and
> machine-enforceable.

## C1 — Declarative `CREATE TABLE` only

A table is fully defined by a single declarative `CREATE TABLE` statement.

- ✅ The table's columns and constraints all live inside one `CREATE TABLE ( … )`.
- ❌ Schema is **not** defined or amended via `ALTER TABLE`. (Reconstructing a table from
  scattered `ALTER` statements is explicitly out of scope.)

## C2 — One table per file, named `schema.table.sql`

- Each `.sql` schema file contains exactly one `CREATE TABLE`.
- File name encodes identity, e.g. `dbo.Customer.sql`, `sales.Invoice.sql`.
- This makes file discovery, model→file mapping, and "where does a new table go" trivial.

## C3 — Explicit, named, table-level constraints

- Primary keys, foreign keys, unique, and check constraints are declared as **named,
  table-level** `CONSTRAINT` clauses.
- ❌ No inline/anonymous shorthand (e.g. column-level `FOREIGN KEY` without a name).
- This gives relationship extraction a single code path and gives every constraint a
  stable identity for round-tripping.

```sql
CREATE TABLE sales.Invoice (
    Id          INT            NOT NULL,
    CustomerId  INT            NOT NULL,
    Total       DECIMAL(18, 2) NOT NULL,
    CONSTRAINT PK_Invoice          PRIMARY KEY (Id),
    CONSTRAINT FK_Invoice_Customer FOREIGN KEY (CustomerId) REFERENCES dbo.Customer (Id)
);
```

## C4 — Canonical formatting (owned by the tool)

The `.sql` files are formatted in **one deterministic canonical style**, and that style is
exactly what the emitter produces. This is the single highest-leverage convention: when
the on-disk format *is* the generator output, the tool can regenerate a whole file and the
Git diff still shows only the lines that truly changed.

The canonical formatter MAY normalize: indentation, internal spacing/alignment, keyword
casing, and trailing commas. The canonical formatter **MUST NOT** reorder members
(see C5).

A formatter/CI check enforces the canonical style so hand edits and tool edits converge.

## C5 — Member order is preserved (never reordered)

Within a table body, the order of **members** (columns and constraints, as written) is
preserved on every round-trip. The emitter never sorts or rearranges members.

This is not cosmetic — comment attachment depends on it. "A comment attaches to the next
member below" only stays stable if the next member below does not move. See
[`04-comment-model.md`](04-comment-model.md).

## C6 — Pinned target and a supported-construct allowlist

- A single pinned SQL Server target version.
- An explicit allowlist of supported constructs (data types, constraint kinds, etc.).
- Anything outside the allowlist is reported as a **diagnostic** (file + line) and the
  affected table is excluded from the model — never silently mis-parsed.

## C7 — Comments follow the comment model

Comment placement is constrained to the four supported slots defined in
[`04-comment-model.md`](04-comment-model.md): table header, table footer, member-leading,
and member-trailing (inline). There are **no free-floating comments inside the table
body** — every in-body comment speaks to a column or constraint, or (at the end of the
body) becomes a footer comment.

## C8 — Layout is never stored in `.sql`

Diagram coordinates and presentation live only in `.erdforge/layout.json`
(see [`05-data-model.md`](05-data-model.md)). `.sql` files contain schema only.

## C9 — Commented-out schema is ignored (not modeled, not an error)

A commented-out `CREATE TABLE` is **invisible to the tool**. If a file's `CREATE TABLE` is
entirely commented out (e.g. `dbo.TierMatrix.sql`), it produces **no table** in the model,
**no node** on the ERD, and **no diagnostic** — it is simply skipped, as if the file were
empty of schema.

- The tool never models, renders, or edits commented-out schema, and never rewrites such a
  file, so the commented text is left byte-for-byte untouched on disk.
- This applies at the member level too: a commented-out column or constraint is **not** a
  column/relationship in the model. Its text is preserved only as ordinary comment trivia
  (see [`04-comment-model.md`](04-comment-model.md)); it never appears as a column or an FK
  edge.
- Real example: `dbo.pr_procurement_item.sql` has commented-out FK constraints — those
  relationships must not appear on the ERD.

## C10 — Relationships come only from declared `FOREIGN KEY` constraints

ERD relationships (edges) are derived **exclusively** from the `FOREIGN KEY` constraints
declared in the `.sql` files. Relationships are defined in code, full stop.

- ✅ An edge exists if and only if there is a declared (non-commented) `FOREIGN KEY`
  constraint for it.
- ❌ **Never infer relationships** from naming conventions, column-name matching
  (e.g. `supplier_id` → `pr_supplier`), data types, or any other heuristic.
- A table with no FK constraints simply has no outgoing edges — that is correct and
  intentional, not a gap to be "filled in" by guessing.
- Commented-out FKs are not relationships (convention C9).

See [ADR-0008](decisions/ADR-0008-fk-only-relationships.md).

## Enforcement

| Convention | Enforced by |
|---|---|
| C1–C3, C6, C7 | Parser diagnostics (loud failure on violation) |
| C4, C5 | Canonical formatter + CI format check |
| C9 | Parser skips commented-out schema silently (no model entry, no diagnostic) |
| C10 | ERD edges built only from declared FK constraints; no inference logic exists |
| Overall correctness | Optional DACPAC build in CI |

## What we give up (accepted trade-offs)

- Tables defined via `ALTER`, inline anonymous constraints, exotic/unlisted constructs,
  and free-floating body comments are unsupported by design.
- The tool is exactly as capable as the agreed conventions. That is an intentional trade
  for reliability and simplicity in an internal tool. See
  [ADR-0003](decisions/ADR-0003-opinionated-subset-and-canonical-format.md).
