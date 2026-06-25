# ADR-0003 — Opinionated SQL subset + canonical formatting

**Status:** Accepted

## Context

This is an **internal** tool used by a team that already follows shared `.sqlproj`
conventions. Supporting the full generality of T-SQL (tables defined via `ALTER`, inline
anonymous constraints, arbitrary formatting and comment placement) would make parsing,
round-tripping, and clean diffs enormously harder.

## Decision

Constrain the supported input to an **opinionated declarative subset** and adopt a
**canonical file format** owned by the tool:

- Declarative `CREATE TABLE` only (no schema via `ALTER`).
- One table per file, named `schema.table.sql`.
- Explicit, named, table-level constraints (no inline anonymous shorthand).
- A single canonical formatting style that the emitter produces and CI enforces.
- Member order is preserved on round-trip; the formatter never reorders.
- A pinned target version and a supported-construct allowlist.

Full details in [`../03-sql-conventions.md`](../03-sql-conventions.md).

## Rationale

- Canonical formatting is the highest-leverage decision: when the on-disk format *is* the
  emitter output, the tool can regenerate a whole file and still produce a minimal,
  reviewable diff. This removes the need for fragile byte-offset surgical edits.
- A small declarative subset makes a pure-TS parser viable
  ([ADR-0002](ADR-0002-pure-typescript-parser.md)).
- The team already writes SQL this way, so the constraint costs little in practice.

## Consequences

- Unsupported constructs are reported as diagnostics and excluded — the tool is exactly as
  capable as the agreed conventions.
- A canonical formatter + CI check must exist to keep hand edits and tool edits converging.
- Member order preservation is a hard requirement because comment attachment depends on it
  ([ADR-0006](ADR-0006-comment-trivia-model.md)).

## Alternatives considered

- **Full T-SQL generality:** rejected — disproportionate complexity for an internal tool;
  would also make round-trip diffs noisy.
- **Surgical text edits preserving arbitrary formatting:** rejected in favor of canonical
  regeneration, which is simpler and keeps diffs clean.
