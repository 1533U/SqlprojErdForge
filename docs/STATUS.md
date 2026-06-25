# STATUS — project snapshot

> The single place to learn "where are we?". Keep this current. See the update routine in
> [`../AGENTS.md`](../AGENTS.md).

**Last updated:** 2026-06-25
**Current phase:** Phase 0 — Parser/emitter spike (not started)
**Overall state:** Design complete; implementation not yet begun.

## Done

- Project scope, architecture, and tech stack defined ([`docs/`](.)).
- SQL conventions, comment model, and data model specified.
- Edit/apply UX and phased roadmap documented.
- 7 ADRs recorded for the key decisions.
- Project-management scaffolding in place (AGENTS.md, STATUS, backlog, CHANGELOG).

## In progress

- _Nothing actively in progress._

## Next up (immediate)

1. **Phase 0 spike** — build a CLI harness: parse real `.sql` → emit → re-parse, and prove
   byte-stable round-tripping including comments. (See [`07-roadmap.md`](07-roadmap.md),
   backlog `P0-*`.)
2. Decide parser approach: hand-written recursive-descent vs Chevrotain.
3. Pin the canonical formatting rules.

## Blocked / needs input

- Need a sample set of **real `.sql` files** from the target `.sqlproj` to drive the Phase 0
  idempotency corpus.

## Open decisions (tracked, not yet final)

- Parser approach (recursive-descent vs Chevrotain).
- Exact canonical formatting rules (indentation, alignment, casing).
- Whether `leadingComments` render on the diagram or only `trailingComment`.
- Whether the layout sidecar is committed for every repo by default.

## Pointers

- Plan & phases → [`07-roadmap.md`](07-roadmap.md)
- Task list → [`backlog.md`](backlog.md)
- History → [`../CHANGELOG.md`](../CHANGELOG.md)
- Decisions → [`decisions/`](decisions/)
