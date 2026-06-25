# ADR-0004 — In-memory derived model, no SQLite

**Status:** Accepted

## Context

The schema model needs to preserve member order and support fast live updates. A question
arose: should we manage this in a small SQLite database, or in memory?

## Decision

Keep the schema model **in memory, derived from the `.sql` files**, rebuilt on change.
**Do not** introduce SQLite (or any other store) as a source of schema truth.

## Rationale

- **Order does not require a database.** Member order is already persisted by the `.sql`
  file itself — the file is an ordered sequence; we parse it into an array (which preserves
  order) and emit in array order. A DB adds nothing here.
- **Single source of truth.** The entire point is a live representation *of the project*.
  Putting schema in a DB creates a second source of truth that can drift and must be
  reconciled — strictly worse.
- **Rebuild-on-change is a feature**, guaranteeing the ERD can never go stale.
- **Performance is a non-issue.** A focused subset parser handles even large projects
  (hundreds of tables) in well under a second, and live edits only re-parse the single
  changed file.
- **Packaging.** Native SQLite (`better-sqlite3`) requires per-Electron-ABI rebuilds;
  `sql.js` (WASM) adds bundle weight — both unjustified for data that is either
  re-derivable (schema) or trivially small (layout).

## Consequences

- The only persistent, non-derivable state is diagram layout, stored as JSON
  ([ADR-0005](ADR-0005-layout-sidecar.md)).
- If cold-start parsing ever becomes slow on a huge project, a **throwaway cache**
  (deletable without data loss, never a source of truth) may be added — but only after
  measuring a real problem.

## Alternatives considered

- **SQLite store for schema:** rejected — creates a competing source of truth, adds
  packaging pain, and solves a performance/ordering problem we don't have.
