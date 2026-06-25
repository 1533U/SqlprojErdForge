# ADR-0012 — Allowlist scope: temporal columns, PERIOD, and post-`GO` statements

**Status:** Accepted

**Refines:** C6 ([`../03-sql-conventions.md`](../03-sql-conventions.md)) and
[ADR-0003](ADR-0003-opinionated-subset-and-canonical-format.md).

## Context

The fixture `purple/dbo.pr_procurement_item.sql` (and several other `pr_*` tables, e.g.
`pr_supplier`, `pr_shipping_type`) use **system-versioned temporal table** features and
trailing statements that are not in the original allowlist:

- `GENERATED ALWAYS AS ROW START` / `ROW END` columns,
- `PERIOD FOR SYSTEM_TIME ([from], [to])` table elements,
- a statement **after `GO`** following the `CREATE TABLE` (a filtered
  `CREATE UNIQUE INDEX … WHERE …`).

A strict reading of C6 ("unsupported construct ⇒ diagnostic ⇒ exclude the whole table")
would drop `pr_procurement_item` — a central node in the FK graph — over a trailing index,
gutting the Phase 0 relationship demonstration. These temporal features are common in this
real schema, so silently excluding such tables understates real coverage.

## Decision

1. **Model temporal columns and `PERIOD FOR SYSTEM_TIME`.** A column may carry a
   `generatedAs: "rowStart" | "rowEnd"` attribute, and a table may contain a
   `periodForSystemTime` member (`{ startColumn, endColumn }`). These round-trip through the
   canonical emitter like any other member.
2. **Post-`GO` trailing statements are a *non-excluding* diagnostic.** Content after the
   `CREATE TABLE` statement's closing `)` (an optional `;`, then `GO` and further
   statements) is reported as a diagnostic and is **not** modeled. The table itself is still
   parsed and modeled normally. Because such a file has un-modeled trailing content, the tool
   treats the whole file as **not round-trippable** and will not rewrite it (consistent with
   the "never rewrite untouched files" rule of
   [ADR-0010](ADR-0010-formatting-strategy-lazy-canonicalization.md)); the in-memory table is
   still available for the ERD.

Index *physical* options on a primary key (`CLUSTERED`, `( col ASC )` layout, `WITH (…)`,
`ON [PRIMARY]`) are parsed and normalized away in canonical output — they carry no ERD
meaning. This produces a one-time normalization diff on the Syspro mirror tables, which are
read-only and never rewritten anyway ([ADR-0011](ADR-0011-syspro-mirror-read-only.md)).

## Rationale

- Temporal columns/PERIOD are real, frequent, and fully round-trippable; modeling them keeps
  central tables in the ERD and avoids spurious exclusions.
- A non-excluding diagnostic for post-`GO` content keeps the table visible while still
  flagging that the file falls outside the round-trip guarantee — honest about coverage
  without losing the node.

## Consequences

- The data model in [`../05-data-model.md`](../05-data-model.md) gains a `generatedAs`
  attribute on `Column` and a `PeriodForSystemTime` member kind. Exhaustive `switch`
  handling over members/constraints must account for the new member kind.
- "Round-trippable" becomes a per-table property: a table whose file has post-`GO` content is
  modeled but not rewritten. Phase 0 idempotency is asserted on the **canonical emitter's
  output** (`emit(parse(emit(x))) === emit(parse(x))`), which is unaffected by the original
  file's trailing content.

## Alternatives considered

- **Strict C6 (diagnose + exclude the whole table):** rejected for Phase 0 — loses a key
  FK-graph node over a trailing index and understates coverage on a temporal-heavy schema.
- **Fully support post-`GO` objects (e.g. model standalone indexes):** deferred — indexes
  are not part of the ERD model today; revisit if index visualization is ever in scope.
