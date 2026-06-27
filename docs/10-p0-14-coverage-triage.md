# 10 — P0-14 real-project coverage triage

> Triage output from `npm run spike:real` against OSConnectWeylandtsDB (~760 build items).
> Last run: 2026-06-27 (after P0-14a file-role filter).

## Summary

| Metric | Before P0-14a | After P0-14a |
|---|---:|---:|
| Parsed tables | 96 | 96 |
| Skipped build items | 664 | 664 |
| Diagnostics (total) | 606 | 597 |
| Errors | 9 | **0** |
| Warnings | 597 | 597 |

**Conclusion:** All nine errors were false positives — stored-proc files whose nested `#temp`
`CREATE TABLE` was mistaken for a top-level table file. File-role detection fixes them without
changing the table model.

## Buckets

### Ignore (no action)

| Bucket | Count | Notes |
|---|---:|---|
| Proc/view/function `.sql` files | 664 | First live DDL is not `CREATE TABLE`; skipped via [`src/sqlFileRole.ts`](../src/sqlFileRole.ts) |
| Commented-out tables (C9) | — | e.g. `TierMatrix` in fixtures; no model entry, no diagnostic |

### Done — P0-14a file-role detection

**Problem:** Discovery scanned every `<Build Include="*.sql">` for `CREATE TABLE`. Proc bodies
contain `#temp` tables → parser error `Expected table name after CREATE TABLE`.

**Fix:** Classify file role from the **first live** `CREATE` statement before calling
`parseTable` ([`src/project.ts`](../src/project.ts)).

**Verification:** `npm run verify:p014`; fixture [`test/fixtures/edge/dbo.SampleProc.sql`](../test/fixtures/edge/dbo.SampleProc.sql).

### Defer — post-`GO` content (ADR-0012)

| Pattern | Count (fixtures + real) | Decision |
|---|---:|---|
| `Un-modeled content after CREATE TABLE ('GO')` | 6 on real project | **Keep warn-only** — table model is correct; file not round-trippable until indexes/extended props are modeled or stripped |

No change needed unless bulk migration or explicit “strip post-GO” emitter work is approved.

### Triage — unsupported column modifiers (P0-14b)

| Pattern | Count | Notes |
|---|---:|---|
| `Unsupported column modifier '…' on '…'` | **591** | Dominates Problems panel noise on real project |

**Next step (optional backlog item P0-14b):** Sample the top modifier tokens from real-project
table files (likely `SPARSE`, `FILESTREAM`, computed/temporal extras, etc.). For each:

- **Model + emit** if common on extension (`pr_*`) tables and needed for edits.
- **Downgrade to info / suppress** if Syspro mirror-only and read-only (ADR-0011).
- **Keep warning** if rare and risky to misread.

Run a one-off categorization script when starting P0-14b:

```bash
npm run spike:real   # summary categories
# then grep parser warnings or extend spike:real with modifier token breakdown
```

### Out of scope

- **Real-project DACPAC in CI** — fixture-only for now ([`P4-2`](../docs/backlog.md)); path is
  machine-local in [`src/verify/paths.ts`](../src/verify/paths.ts).
- **Parser decomposition** — tracked in [`08-refactor-plan.md`](08-refactor-plan.md) when
  allowlist work justifies it.

## Follow-on backlog

| ID | Task | Priority |
|---|---|---|
| P0-14a | File-role detection before table parse | **done** |
| P0-14b | Column-modifier allowlist triage + top-N fixes | medium |
| P0-14c | Optional: downgrade post-GO warnings for read-only mirror paths | low |

## Verification gate

```bash
npm run verify:p014 && npm run spike:real
# expect: 96 tables, 0 errors, ~597 warnings
```
