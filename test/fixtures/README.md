# Test fixtures

Curated, real `.sql` files copied from an example SSDT project
(`OSConnectWeylandtsDB`) to drive the Phase 0 parser/emitter idempotency spike and later
parser tests. They are a representative sample, **not** the whole project (835 files).

Grouped by the two authoring styles plus deliberate edge cases.

## `SampleErd.sqlproj` — synthetic project entry point

The real tool starts at the `.sqlproj` (MSBuild XML) and discovers `.sql` files from its
`<Build Include="...">` items, **not** from a folder scan. `SampleErd.sqlproj` is a small,
self-contained project file that references the fixtures below so discovery can be tested
realistically. It deliberately exercises:

- **Windows backslash paths** (`purple\dbo.pr_supplier.sql`) that must be normalized.
- Files spread across subfolders (`purple` / `syspro` / `edge`).
- A `<None Include>` item and the `README.md`, so the loader must filter build items and
  identify non-tables (no `CREATE TABLE`) without crashing.

For pure parse↔emit round-trip tests, point the harness at the individual `.sql` files
(unit granularity). For discovery tests, start from `SampleErd.sqlproj`. A separate
integration smoke test should run discovery against the real project (~807 build items) at
`/home/gerhard/Projects/Purple/OSConnectWeylandtsDB-master/OSConnectWeylandtsDB.sqlproj`.

## `purple/` — hand-written extension tables (clean, conventions-aligned)

These match our design closely: named table-level `PK_*` / `FK_*` constraints,
leading-comma layout, comments in our supported slots.

| File | Exercises |
|---|---|
| `dbo.pr_procurement_header.sql` | Named PK + 7 named FKs; member-leading (`--costing type control`) and member-trailing inline comments; `IDENTITY`, `DEFAULT(...)`, `COLLATE`; a commented-out column |
| `dbo.pr_procurement_item.sql` | FK to `pr_procurement_header` (2-level graph); commented-out FK constraints; an unbracketed `REFERENCES`; FKs to tables outside this set (dangling refs) |
| `dbo.pr_supplier.sql` | FK target of header/item |
| `dbo.pr_port.sql` | Single table referenced by two different FKs (port_of_load / destination) |
| `dbo.pr_buying_season.sql` | FK target |
| `dbo.pr_shipping_type.sql` | FK target with a non-int key (`NCHAR(3)` code) |
| `dbo.pr_procurement_header_status.sql` | FK target with a `TINYINT` key |
| `dbo.pr_syspro_buyer.sql` | FK target |

This subset forms a resolvable relationship graph (header → status/supplier/port/season/
shipping_type/buyer; item → header/supplier), with some intentionally dangling references.

## `syspro/` — machine-exported ERP mirror tables

| File | Exercises |
|---|---|
| `dbo.InvBuyer.sql` | Bracket-quoted identifiers; `PRIMARY KEY CLUSTERED` with `( col ASC )` index layout; no foreign keys; `timestamp` column |

## `edge/` — deliberately gnarly cases

| File | Exercises |
|---|---|
| `dbo.TierMatrix.sql` | **Entirely commented-out** `CREATE TABLE` — parser must yield no table (and not crash) |
| `dbo.PorMasterHdr+.sql` | Table/constraint name containing `+`; `PRIMARY KEY CLUSTERED` with commented-out `WITH (...)` options and `ON [PRIMARY]`; mixed bracketed/unbracketed columns |

## `comments/` — comment model coverage

| File | Exercises |
|---|---|
| `dbo.CommentSlots.sql` | All four comment slots (header, member-leading, member-trailing, footer) **plus** the rule-5 footer fallback (a body comment with no member below). Mirrors the worked example in [`docs/04-comment-model.md`](../../docs/04-comment-model.md) so the Phase 0 spike can assert exact attachment. |

## Source

Copied from `/home/gerhard/Projects/Purple/OSConnectWeylandtsDB-master`. The original
project is never modified by this tool; fixtures are a local, committed snapshot for tests.
