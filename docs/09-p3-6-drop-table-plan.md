# P3-6 — Drop table (implementation plan)

**Status:** done (2026-06-27)

**Goal:** Delete a table's `.sql` file and remove its `.sqlproj` build item and layout entry in lockstep.

## Pipeline (mirror P3-5)

```
validate → clone model (remove table) → build candidates → sequential diff preview → Apply/Discard
```

| Candidate | Action | Flag |
|---|---|---|
| `schema.table.sql` | Delete file | `isDeleteFile: true`, empty `candidateContent` |
| `.sqlproj` | Remove `<Build Include="…">` line | only when include exists |
| `.erdforge/layout.json` | Remove table key | only when entry exists |

## Validation

- Table must exist and not be read-only (ADR-0011).
- **Inbound FKs:** warn in webview banner; do **not** block preview/apply (docs/06-edit-ux.md).

## Webview UX

- Header **Drop table** → click editable table header → banner shows target + inbound-FK warning → **Preview drop**.
- Reuse `selectTableForDrop` in `editInteraction.ts`; inbound refs from `payload.edges`.

## Verify (`npm run verify:p3`)

- Happy path on `dbo.pr_shipping_type` (sql + sqlproj + layout candidates).
- Reject read-only `dbo.InvBuyer`, missing table.

**Next after P3-6:** P3-7 rename table.
