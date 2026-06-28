# 10 — P0-14 real-project coverage triage

> Triage output from `npm run spike:real` against OSConnectWeylandtsDB (~760 build items).
> Last run: 2026-06-28 (after P0-14b column-modifier grammar, ADR-0015).

## Summary

| Metric | Before P0-14a | After P0-14a | After P0-14b |
|---|---:|---:|---:|
| Parsed tables | 96 | 96 | 96 |
| Skipped build items | 664 | 664 | 664 |
| Diagnostics (total) | 606 | 597 | **6** |
| Errors | 9 | **0** | 0 |
| Warnings | 597 | 597 | **6** |

**Conclusion:** The nine original errors were proc-file false positives, fixed by file-role
detection (P0-14a). The 591 remaining "unsupported column modifier" warnings collapsed to
**five** column constructs the parser couldn't consume as a unit; modeling them (P0-14b /
ADR-0015) reduced total diagnostics to the **6** residual ADR-0012 post-`GO` warnings, with
all 96 tables still round-tripping to a canonical fixed point.

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

### Done — P0-14b column-modifier grammar (ADR-0015)

The 591 "unsupported column modifier" warnings were **not** a long tail of exotic features.
They collapsed to **five** column constructs the parser couldn't consume as a unit (so it
warned once per leftover token). Categorized by construct from the real project:

| Construct | Warnings | Files | Decision |
|---|---:|---|---|
| Inline (nameless) column `CHECK (…)` | 545 | 3 | **Model + emit** (`Column.checks[]`) |
| Computed column `col AS expr` (+ `PERSISTED`) | 28 | 3 | **Model + emit** (fix `AS`-as-type bug; `persisted`) |
| `ROWGUIDCOL` + inline `UNIQUE` + `DEFAULT NEWSEQUENTIALID()` | 13 | 4 | **Model + emit** (`rowguidcol`, `uniqueInline`; `readExpr` func calls) |
| `FILESTREAM` | 3 | 3 | **Model + emit** (`filestream`) |
| Inline `PRIMARY KEY` | 2 | 1 | **Model + emit** (`primaryKeyInline`) + ERD PK badge |

All five occur on **editable** extension tables, so modeling + emitting (not
downgrade-and-drop) is required for round-trip and edit safety. **Result: 591 → 0 modifier
warnings; total 597 → 6.** All 96 tables still reach a canonical fixed point. See
[ADR-0015](decisions/ADR-0015-column-modifier-grammar.md).

**Fix:** `src/model.ts` (Column attributes), `src/parser.ts` (computed detection, function-call
`readExpr`, new modifier branches), `src/emitter.ts` (canonical column order),
`src/diagram/graphBuild.ts` (inline-PK badge). Fixture:
[`test/fixtures/edge/dbo.ColumnModifiers.sql`](../test/fixtures/edge/dbo.ColumnModifiers.sql).

### Out of scope

- **Real-project DACPAC in CI** — fixture-only for now ([`P4-2`](../docs/backlog.md)); path is
  machine-local in [`src/verify/paths.ts`](../src/verify/paths.ts).
- **Parser decomposition** — tracked in [`08-refactor-plan.md`](08-refactor-plan.md) when
  allowlist work justifies it.

## Follow-on backlog

| ID | Task | Priority |
|---|---|---|
| P0-14a | File-role detection before table parse | **done** |
| P0-14b | Column-modifier grammar (inline CHECK / computed / ROWGUIDCOL / FILESTREAM / inline PK+UNIQUE) | **done** (ADR-0015) |
| P0-14c | Optional: downgrade post-GO warnings for read-only mirror paths | low |

## Verification gate

```bash
npm run verify:p014 && npm run spike:real
# expect: 96 tables, 0 errors, 6 warnings (post-GO residue), 0 modifier warnings
```
