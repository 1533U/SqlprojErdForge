# ADR-0005 — Committed JSON layout sidecar

**Status:** Accepted

## Context

An ERD has two kinds of information: **schema facts** (tables/columns/FKs — which live in
`.sql`) and **diagram presentation** (where each table box sits, zoom, color, collapsed
state). Presentation is not schema and must not pollute the `.sql` files. We need a place
to persist it.

## Decision

Store diagram presentation in a **JSON sidecar** at `.erdforge/layout.json`, keyed by
stable identity (`schema.table`), and **commit it to Git**.

## Rationale

- Keeps `.sql` files schema-only — no coordinate noise, no spurious diffs.
- Keyed by `schema.table` so it survives reformatting and member reordering.
- JSON is tiny (one entry per table), human-readable, and **diffable in Git**, so layout
  changes are reviewable in PRs.
- Committing it means the team shares one curated diagram — part of the tool's value for
  internal use.
- A table absent from the file is auto-placed by ELK on first render, then written back.

## Consequences

- Table rename/drop must migrate/remove the corresponding layout entry in lockstep with
  the schema edit.
- A binary store (e.g. SQLite) was explicitly avoided here because it is not diffable and
  would be a poor fit for a committed, shared artifact.

## Alternatives considered

- **Git-ignored sidecar (per-developer layout):** viable, but shared layout is more
  valuable for an internal team; can be made configurable later.
- **Coordinates inside `.sql` (comments/extended properties):** rejected — pollutes the
  source of truth and creates noisy diffs.
