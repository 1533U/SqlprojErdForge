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

## Enforcement

| Convention | Enforced by |
|---|---|
| C1–C3, C6, C7 | Parser diagnostics (loud failure on violation) |
| C4, C5 | Canonical formatter + CI format check |
| Overall correctness | Optional DACPAC build in CI |

## What we give up (accepted trade-offs)

- Tables defined via `ALTER`, inline anonymous constraints, exotic/unlisted constructs,
  and free-floating body comments are unsupported by design.
- The tool is exactly as capable as the agreed conventions. That is an intentional trade
  for reliability and simplicity in an internal tool. See
  [ADR-0003](decisions/ADR-0003-opinionated-subset-and-canonical-format.md).
