# ADR-0013 — Canonical format rules (pinned)

**Status:** Accepted

**Settles:** open item **P0-15**; completes the formatting-rules follow-on from
[ADR-0010](ADR-0010-formatting-strategy-lazy-canonicalization.md) (D1).

## Context

C4 ([`../03-sql-conventions.md`](../03-sql-conventions.md)) requires one deterministic
canonical style so whole-file regeneration yields minimal diffs. ADR-0010 chose *when* to
apply that style (lazy, on edit). The *exact* rules — indent width, comma style, keyword
casing, identifier bracketing — were deferred while the Phase 0 emitter proved the fixed
point on fixtures.

The spike emitter ([`../../src/emitter.ts`](../../src/emitter.ts)) now defines a stable
fixed point on the corpus (`npm run spike`). Pinning the rules before `P4-1` avoids building
a formatter that diverges from the emitter users already get on every edit.

## Decision

Adopt the **spike emitter output** as the canonical format specification, documented in
**C4.1–C4.8** of [`../03-sql-conventions.md`](../03-sql-conventions.md). Highlights:

| Topic | Rule |
|---|---|
| Indent | 4 spaces; no tabs |
| Commas | Trailing (not leading) |
| `CREATE TABLE` | Opening `(` on the same line |
| Keywords / types | UPPERCASE |
| Simple identifiers | Unbracketed (`^[A-Za-z_][A-Za-z0-9_]*$`) |
| Alignment | None — single space between tokens |
| Blank lines in body | None |
| Member order | Preserved (C5) — formatter must not reorder |

**Reference implementation:** `src/emitter.ts` until `P4-1` ships a standalone formatter;
both must produce identical output on the supported subset.

**CI scope:** unchanged from ADR-0010 — format check on **changed files only** during the
lazy-canonicalization transition.

## Rationale

- The emitter is battle-tested (idempotency spike + eight Phase 3 edit ops re-emit through it).
- Choosing a *new* style now would invalidate reviewed normalization diffs and fixture expectations.
- Documenting the emitter's behavior makes `P4-1` a conformance task, not a design debate.

## Consequences

- Legacy `pr_*` files (leading commas, tab alignment, bracketed identifiers) will show a
  one-time normalization diff on first edit — expected per ADR-0010.
- Syspro mirror tables remain read-only (ADR-0011) and are excluded from bulk migration.
- `P4-1` can proceed: implement format check = `parse → emit` equals on-disk for changed files.
- Any future style change requires a new ADR and a deliberate migration — not silent drift.

## Alternatives considered

- **Tab indent + leading commas (legacy `pr_*` style):** rejected — emitter already fixed
  on trailing commas + spaces; switching would churn all canonical fixture outputs.
- **Always bracket identifiers (`[dbo].[table]`):** rejected — spike uses bare simple names;
  fewer characters, matches add-table/edit emit today.
- **Preserve column alignment padding:** rejected — alignment is not in the model; preserving
  it would require a separate formatting layer contradicting ADR-0003.
