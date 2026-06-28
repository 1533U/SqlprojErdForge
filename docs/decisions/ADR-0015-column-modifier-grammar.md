# ADR-0015 — Expand the modeled column grammar (inline CHECK, computed/PERSISTED, ROWGUIDCOL, FILESTREAM, inline PK/UNIQUE)

**Status:** Accepted

**Refines:** C6 ([`../03-sql-conventions.md`](../03-sql-conventions.md)),
[ADR-0003](ADR-0003-opinionated-subset-and-canonical-format.md), and
[ADR-0012](ADR-0012-allowlist-scope.md).

## Context

Triage of the real `OSConnectWeylandtsDB` project (`P0-14b`) showed **591** of the 597
"unsupported column modifier" warnings collapse to just **five** column constructs. The
parser could not consume any of them as a unit, so it emitted **one warning per leftover
token** (e.g. a single inline `CHECK (...)` produced a warning for `CHECK`, `(`, each
operand, `=`, `OR`, `)`, …). Categorized by construct:

| Construct | Warnings | Files |
|---|---:|---|
| Inline (nameless) column `CHECK (…)` | 545 | 3 |
| Computed column `col AS expr` (+ `PERSISTED`) | 28 | 3 |
| `ROWGUIDCOL` + inline `UNIQUE` + `DEFAULT NEWSEQUENTIALID()` | 13 | 4 |
| `FILESTREAM` | 3 | 3 |
| Inline `PRIMARY KEY` | 2 | 1 |

Crucially, **all five occur on editable extension tables** (`pr_*`, `dsv_*`,
`resource_*` — none are read-only Syspro mirrors per
[ADR-0011](ADR-0011-syspro-mirror-read-only.md)). Two consequences followed from leaving
them unmodeled:

1. **Latent correctness bug.** A computed column `col AS expr` was mis-read as a column
   whose data type is the literal token `AS`, so it never round-tripped.
2. **Data-loss risk.** Any future rewrite (Phase-3 edit, lazy canonicalization) would drop
   the CHECK/DEFAULT/computed/storage attributes the model never captured.

The allowlist principle in ADR-0012 ("model what is frequent and round-trippable; do not
silently drop") therefore points to **modeling and emitting** these constructs rather than
downgrading the diagnostic and dropping them.

## Decision

Expand the **column** grammar (no new `Member` kind) with these attributes on `Column`:

- `checks?: string[]` — inline nameless `CHECK (<expr>)` clauses, in source order, stored as
  canonically-rendered expression text.
- `computed?: string` (existing) is now parsed correctly via `col AS <expr>` at the
  type position; `persisted?: boolean` records a trailing `PERSISTED`.
- `rowguidcol?: boolean`, `filestream?: boolean` — storage attributes.
- `primaryKeyInline?: boolean`, `uniqueInline?: boolean` — inline column constraints.

Supporting parser change: `readExpr` now also consumes function-call expressions
(`name( … )`) so `DEFAULT NEWSEQUENTIALID()` and computed bodies like
`ISNULL(DATALENGTH([b]), 0)` are captured whole.

The emitter writes these in one **canonical column order** so
`emit(parse(emit(x))) === emit(parse(x))`:

```
name type [COLLATE c] [FILESTREAM] [ROWGUIDCOL] [NULL|NOT NULL] [IDENTITY]
     [DEFAULT expr] [PRIMARY KEY] [UNIQUE] [CHECK (expr)]*
```

Computed columns emit as `name AS expr [PERSISTED [NULL|NOT NULL]]`. An inline
`PRIMARY KEY` also contributes its column to the ERD PK badge set (it was previously
invisible to the diagram).

Named column-level constraints (`CONSTRAINT n DEFAULT/CHECK …`) do **not** occur in this
corpus and remain out of scope; they would still produce a diagnostic.

## Rationale

- These are common, well-defined T-SQL column features on editable tables — modeling them
  removes 591/591 modifier warnings, fixes the computed-column bug, and makes the affected
  tables faithfully round-trippable, which is a precondition for safe editing.
- Keeping them as **column attributes** (not a new member kind) leaves the `Member`
  discriminated union and every exhaustive `switch` untouched, minimizing blast radius.

## Consequences

- The data model in [`../05-data-model.md`](../05-data-model.md) gains the attributes above
  on `Column`. The emitter is the canonical reference (C4 / ADR-0013); the first emit of a
  previously non-canonical file is a one-time normalization (ADR-0010, "format on touch").
- The green gate `npm run verify:p014` now asserts, on the real project: **0** unsupported
  modifier warnings (was 591), total diagnostics **6** (the residual ADR-0012 post-`GO`
  warnings), 96 tables, and that **all 96 tables reach a canonical fixed point**. A new
  fixture `test/fixtures/edge/dbo.ColumnModifiers.sql` exercises all five constructs.
- Edit guardrails (`src/edits/memberChecks.ts`) are **not** changed here; inline-PK columns
  were never modeled before, so removal behavior is unchanged (no regression). Teaching the
  guardrails about inline PK/UNIQUE is an optional follow-up.

## Alternatives considered

- **Downgrade the diagnostic and drop the modifiers:** rejected — silently discards real
  schema on editable tables and breaks round-trip/edit safety.
- **Model inline PK/UNIQUE/CHECK as synthetic table-level constraints:** rejected — would
  invent names, reorder members (violating C5), and change file shape; column attributes
  preserve the inline source form.
