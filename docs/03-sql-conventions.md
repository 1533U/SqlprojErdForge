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

The canonical formatter MAY normalize: indentation, internal spacing, keyword casing, and
trailing commas. The canonical formatter **MUST NOT** reorder members (see C5).

A formatter/CI check enforces the canonical style so hand edits and tool edits converge.
**When strategy applies:** lazy canonicalization per
[ADR-0010](decisions/ADR-0010-formatting-strategy-lazy-canonicalization.md) — only edited
files are rewritten; CI format checks are scoped to changed files until a bulk migration.

The subsections below are the **pinned canonical format** (settled `P0-15`, 2026-06-27;
[ADR-0013](decisions/ADR-0013-canonical-format-rules.md)). The reference implementation is
[`src/emitter.ts`](../src/emitter.ts); `P4-1` must match it byte-for-byte on the supported
subset.

### C4.1 — File-level

| Rule | Canonical |
|---|---|
| Line endings | LF (`\n`) only |
| Encoding | UTF-8 |
| Trailing newline | Exactly one `\n` at EOF |
| Trailing whitespace | None on any line |
| Scope | One `CREATE TABLE` per file (C2); no content after the closing `);` except table footer comments (C7) |

### C4.2 — Keywords and identifiers

- **Keywords** (`CREATE`, `TABLE`, `NOT`, `NULL`, `CONSTRAINT`, `PRIMARY`, `KEY`, `FOREIGN`,
  `REFERENCES`, `UNIQUE`, `CHECK`, `IDENTITY`, `DEFAULT`, `COLLATE`, `GENERATED`, `ALWAYS`,
  `AS`, `ROW`, `START`, `END`, `PERIOD`, `FOR`, `SYSTEM_TIME`, `ON`, `DELETE`, `UPDATE`,
  `CASCADE`, `NO`, `ACTION`, `SET`, …): **UPPERCASE**.
- **Data-type names** (`INT`, `VARCHAR`, `NVARCHAR`, `DATETIME2`, `DECIMAL`, …): **UPPERCASE**.
- **Simple identifiers** — match `^[A-Za-z_][A-Za-z0-9_]*$` — are emitted **unbracketed**
  (`dbo`, `pr_supplier`, `shipping_type_code`).
- **Non-simple identifiers** (contain `+`, spaces, reserved words, etc.) are **bracket-quoted**:
  `[PorMasterHdr+]`, `]]` inside a name is escaped as `]]`.
- **Qualified names** use a dot with no surrounding spaces: `schema.table`, `[schema].[table]`
  when either part requires brackets.

Index options (`CLUSTERED`, `WITH (…)`, `ON [PRIMARY]`) are **not** part of canonical output
(see [ADR-0012](decisions/ADR-0012-allowlist-scope.md)).

### C4.3 — Table header and body layout

```sql
-- optional table header comment(s)
CREATE TABLE schema.table_name (
    <member line 1>,
    <member line 2>,
    …
    <last member line>
);
-- optional table footer comment(s)
```

| Rule | Canonical |
|---|---|
| `CREATE TABLE` line | Keyword, qualified table name, and opening `(` on **one line** |
| Member indent | **4 spaces** (no tabs) |
| Members per line | **One** column, constraint, or `PERIOD` clause per line |
| Commas | **Trailing** comma on every member **except the last** |
| Closing | `);` on its own line — no comma before `)` |
| Blank lines inside `( … )` | **None** — column-grouping blank lines from legacy files are dropped on emit |
| Column alignment | **None** — no padding columns to a fixed width; single space between tokens |

### C4.4 — Column lines

General shape (tokens in order, omitting optional clauses):

```
<name> <dataType> [COLLATE <collation>] [NOT NULL | NULL] [IDENTITY[(seed, increment)]] [DEFAULT <expr>]
```

| Clause | Canonical |
|---|---|
| Nullability | Explicit `NOT NULL` or `NULL` on every non-generated column |
| `IDENTITY` | Bare `IDENTITY` when `(1, 1)`; otherwise `IDENTITY(seed, increment)` with comma + space |
| `DEFAULT` | `DEFAULT` + single space + expression; parenthesized calls preserved, e.g. `DEFAULT (GETUTCDATE())` |
| `COLLATE` | Between data type and nullability: `VARCHAR(10) COLLATE Latin1_General_BIN NULL` |
| Temporal | `GENERATED ALWAYS AS ROW START` / `… ROW END` — no nullability clause on generated columns |
| Computed | `<name> AS <expr>` — no separate type/nullability |
| Data-type args | Uppercase type; `(` immediately after type name; args separated by `, ` — e.g. `DECIMAL(19, 6)`, `VARCHAR(50)`, `DATETIME2(2)` |
| Trailing comment | Space + `--` + space + text at end of member line (C7) |

### C4.5 — Constraint lines

All constraints are **named, table-level** (C3):

```sql
    CONSTRAINT <name> PRIMARY KEY (<col>, …),
    CONSTRAINT <name> FOREIGN KEY (<col>, …) REFERENCES <schema>.<table> (<col>, …)
        [ON DELETE <action>] [ON UPDATE <action>],
    CONSTRAINT <name> UNIQUE (<col>, …),
    CONSTRAINT <name> CHECK <expr>,
```

- Constraint and column lists: comma + space between items; simple identifiers unbracketed.
- `ON DELETE` / `ON UPDATE` actions: `NO ACTION`, `CASCADE`, `SET NULL`, `SET DEFAULT` (uppercase).
- `CHECK` expressions are re-emitted from the parsed model; bracket quoting inside the
  expression follows the source tokens (no forced unbracketing).

### C4.6 — `PERIOD FOR SYSTEM_TIME`

Emitted as a normal member line (same indent and trailing-comma rules):

```sql
    PERIOD FOR SYSTEM_TIME (start_column, end_column),
```

### C4.7 — Comments (see also C7)

| Slot | Position |
|---|---|
| Table header | `-- text` at column 0, before `CREATE TABLE` |
| Member leading | `-- text` with 4-space indent, immediately above the member |
| Member trailing | ` -- text` after the member body (before the comma, if any) |
| Table footer | `-- text` at column 0, after `);` |

Block comments (`/* … */`) inside the table body are not canonical; the parser may lift
content into supported slots or footer trivia.

### C4.8 — Normalization example

Legacy hand-written style (leading commas, tabs, brackets, alignment) normalizes to:

```sql
CREATE TABLE dbo.pr_procurement_header_status (
    procurement_header_status_id TINYINT NOT NULL,
    procurement_header_status_code VARCHAR(20) NOT NULL,
    procurement_header_status_desc VARCHAR(50) NOT NULL,
    CONSTRAINT PK_procurement_header_status PRIMARY KEY (procurement_header_status_id),
    CONSTRAINT AK_procurement_header_status_code UNIQUE (procurement_header_status_code)
);
```

This is the fixed point: `emit(parse(emit(x)))` equals `emit(parse(x))` on the fixture corpus.

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
