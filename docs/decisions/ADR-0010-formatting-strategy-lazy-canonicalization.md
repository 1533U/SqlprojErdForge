# ADR-0010 — Formatting strategy: lazy canonicalization ("format on touch")

**Status:** Accepted

**Settles:** open decision **D1**; addresses risk **R1**
([`../07-roadmap.md`](../07-roadmap.md)).

## Context

The real `.sql` files are **not** canonically formatted and use two incompatible house
styles (clean hand-written `pr_*` with leading commas + tab alignment; machine-exported
Syspro mirror tables with trailing commas + `[type]` brackets). C4
([`../03-sql-conventions.md`](../03-sql-conventions.md)) wants the on-disk format to *be*
the emitter output so a whole-file regeneration still yields a minimal Git diff. The danger
(R1): if the tool reformats an already-non-canonical file on first edit, the reformat noise
swamps the real change and defeats the clean-diff goal.

Four strategies were considered: (a) preserve existing formatting via surgical edits,
(b) impose the canonical style eagerly on any touch, (c) canonicalize only the tables we
actually edit ("format on touch"), (d) a one-time bulk format migration.

## Decision

Adopt **(c): lazy canonicalization**. There is exactly **one** canonical style — the
emitter's output (C4) — applied **only when a table is edited through the tool** (or via an
explicit, opt-in "format this file" command). Concretely:

- **Untouched files are never rewritten** — they stay byte-for-byte as authored, so both
  house styles coexist at rest with zero diff noise.
- When a table *is* edited, its whole file is regenerated in canonical form. The first such
  edit carries a one-time normalization diff scoped to that single file (which was changing
  anyway); every subsequent edit is a minimal diff.
- A one-time **bulk migration (d)** is kept available as a *future*, deliberate, reviewed
  one-shot — only after the emitter is battle-tested, and **excluding** Syspro mirror tables
  ([ADR-0011](ADR-0011-syspro-mirror-read-only.md)), which the ERP re-exports.

## Rationale

- Preserves the C4 architecture: the canonical emitter is the **single writer**; we never
  fall back to fragile byte-offset surgery (rejected in
  [ADR-0003](ADR-0003-opinionated-subset-and-canonical-format.md)).
- Keeps diffs reviewable: normalization cost is paid per-file, only on files already being
  changed — the standard incremental formatter-adoption pattern.
- The repo converges to canonical naturally over time, without a risky big-bang rewrite
  before the emitter is proven.

## Consequences

- The repo is **heterogeneous during transition** (some files canonical, some not). The CI
  format check (P4-1) must therefore be **scoped to changed files**, not enforced globally,
  until/unless a bulk migration happens.
- Canonicalizing a `pr_*` table **drops non-modeled whitespace** — notably blank-line
  grouping between column clusters. Section *comments* survive (they become a member's
  `leadingComments`), but blank lines do not. This is an accepted normalization cost.
- Because re-emitting an already-canonical file is a no-op, no "is canonical" marker is
  needed; canonical state is defined by the emitter being a fixed point.
- **Exact format rules** are pinned in C4.1–C4.8 of [`../03-sql-conventions.md`](../03-sql-conventions.md)
  and [ADR-0013](ADR-0013-canonical-format-rules.md) (`P0-15`).
- Option (a) is rejected outright: it contradicts
  [ADR-0003](ADR-0003-opinionated-subset-and-canonical-format.md).

## Alternatives considered

- **(a) Preserve formatting / surgical edits:** rejected — contradicts ADR-0003, breaks the
  trivia re-emission model, needs a separate patch-based emitter.
- **(b) Eager canonicalization:** rejected — dumps a large reformat diff on the *first*
  touch of every messy file; this is risk R1 itself.
- **(d) Bulk migration now:** rejected *as the initial move* — a ~760-file commit is risky
  before the emitter is proven and would churn machine-exported tables; retained as a
  future option.
