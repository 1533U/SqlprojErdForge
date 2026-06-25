# ADR-0008 — Relationships come only from declared FOREIGN KEY constraints

**Status:** Accepted

## Context

Some ERD tools infer relationships heuristically (e.g. matching a `supplier_id` column to a
`pr_supplier` table by name) to produce richer-looking diagrams, especially for schemas
that lack explicit foreign keys. In this project, **all foreign keys are defined explicitly
in the `.sql` files** as named `FOREIGN KEY` constraints — relationships are part of the
code, not a convention to be guessed.

## Decision

Derive ERD relationships **exclusively** from declared (non-commented) `FOREIGN KEY`
constraints. **Never** infer relationships from naming, column matching, data types, or any
other heuristic. Codified as convention C10 in
[`../03-sql-conventions.md`](../03-sql-conventions.md).

## Rationale

- Relationships are authored in code; the SQL is authoritative. Inference would invent
  edges that do not exist in the schema and could mislead.
- Determinism: the ERD is a faithful projection of the FK constraints, with no fuzzy logic
  to tune, explain, or get wrong.
- Simplicity: no inference engine to build, configure, or maintain.

## Consequences

- A table with no FK constraints has no outgoing edges. That is correct and intentional,
  not a deficiency to be patched.
- Tables whose relationships are not modeled as FKs (e.g. machine-exported ERP mirror
  tables) will appear without edges; if that is undesirable, the answer is to declare the
  FKs in code, not to infer them.
- Bidirectional editing only ever adds/removes/changes **real** FK constraints in the
  `.sql` files.

## Alternatives considered

- **Name/heuristic-based inference (optional toggle):** explicitly rejected — relationships
  must reflect what is declared in code, nothing more.
