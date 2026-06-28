# 05 — Data Model

This document defines the in-memory schema model and the layout sidecar format. The model
is **derived from the `.sql` files** and is disposable; the files remain the single source
of truth.

> These TypeScript types are the design target for the Phase 0 spike. Treat them as the
> contract between parser, emitter, and webview.

## Schema model

```ts
/** A whole SQL Server database project, parsed from its .sql files. */
interface ProjectModel {
  /** Absolute path to the .sqlproj. */
  projectPath: string;
  /** Tables keyed by fully-qualified name, e.g. "dbo.Customer". */
  tables: Map<string, Table>;
  /** Parse diagnostics for files/tables that violated the conventions. */
  diagnostics: Diagnostic[];
}

interface Table {
  schema: string;            // "dbo"
  name: string;              // "Customer"
  /** Source file this table was parsed from, e.g. "dbo.Customer.sql". */
  sourceFile: string;
  /** Columns and constraints in *source order* (never reordered). */
  members: Member[];
  headerComments?: string[]; // comments above CREATE TABLE
  footerComments?: string[]; // comments below the table / orphaned body comments
}

type Member = Column | Constraint;

interface Column {
  kind: "column";
  name: string;              // "CustomerId"
  dataType: string;          // canonical, e.g. "NVARCHAR(100)", "DECIMAL(18, 2)"
  nullable: boolean;
  identity?: { seed: number; increment: number };
  default?: string;          // raw default expression, e.g. "(getutcdate())"
  computed?: string;         // raw computed expression, if a computed column (`col AS expr`)
  persisted?: boolean;       // PERSISTED on a computed column (ADR-0015)
  collate?: string;          // collation name
  generatedAs?: "rowStart" | "rowEnd"; // temporal system-versioning column (ADR-0012)
  checks?: string[];         // inline nameless CHECK expressions, in source order (ADR-0015)
  primaryKeyInline?: boolean; // inline PRIMARY KEY on the column (ADR-0015)
  uniqueInline?: boolean;    // inline UNIQUE on the column (ADR-0015)
  rowguidcol?: boolean;      // ROWGUIDCOL storage attribute (ADR-0015)
  filestream?: boolean;      // FILESTREAM storage attribute (ADR-0015)
  leadingComments?: string[];
  trailingComment?: string;  // shown on the ERD as the column description
}
// Note: `Member` also includes a `PeriodForSystemTime` kind (ADR-0012). The authoritative
// model lives in `src/model.ts`; ADR-0012 / ADR-0015 record the column-grammar extensions.

type Constraint =
  | PrimaryKeyConstraint
  | ForeignKeyConstraint
  | UniqueConstraint
  | CheckConstraint;

interface ConstraintBase {
  name: string;              // named, per convention C3
  leadingComments?: string[];
  trailingComment?: string;
}

interface PrimaryKeyConstraint extends ConstraintBase {
  kind: "constraint";
  constraintType: "primaryKey";
  columns: string[];
}

interface ForeignKeyConstraint extends ConstraintBase {
  kind: "constraint";
  constraintType: "foreignKey";
  columns: string[];                 // local columns
  references: {
    schema: string;                  // referenced table schema
    table: string;                   // referenced table name
    columns: string[];               // referenced columns
  };
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
}

interface UniqueConstraint extends ConstraintBase {
  kind: "constraint";
  constraintType: "unique";
  columns: string[];
}

interface CheckConstraint extends ConstraintBase {
  kind: "constraint";
  constraintType: "check";
  expression: string;                // raw check expression
}

type ReferentialAction = "noAction" | "cascade" | "setNull" | "setDefault";

interface Diagnostic {
  file: string;
  line: number;
  column?: number;
  severity: "error" | "warning";
  message: string;                   // e.g. "Unsupported construct: ALTER TABLE"
}
```

### Notes

- `members` is a single ordered array mixing columns and constraints, mirroring source
  order exactly (convention C5). Comment attachment depends on this order.
- The discriminated unions use `kind` (column vs constraint) and `constraintType`. Switch
  statements over these MUST be exhaustive with a `never` default case.
- Data types and expressions are stored in canonical text form so the emitter can print
  them directly.

### Deriving the ERD

The diagram is computed from `ProjectModel`:

- **Nodes** = tables; rows = columns (PK/FK badges from constraints).
- **Edges** = foreign-key constraints (`Table.members` where `constraintType ===
  "foreignKey"`), from local table → `references.table`. Edges are derived **only** from
  declared FK constraints — never inferred from names or types (convention C10 /
  [ADR-0008](decisions/ADR-0008-fk-only-relationships.md)).

## Layout sidecar

Diagram presentation is **not** schema and never goes into `.sql`. It lives in a committed
JSON file so the team shares one curated layout and changes are reviewable in Git.

**Path:** `.erdforge/layout.json`

```jsonc
{
  "version": 1,
  "tables": {
    "dbo.Customer":  { "x": 120, "y": 80,  "collapsed": false },
    "dbo.Order":     { "x": 480, "y": 80 },
    "sales.Invoice": { "x": 480, "y": 360, "color": "#ffe8cc" }
  }
}
```

```ts
interface LayoutFile {
  version: 1;
  tables: Record<string, TableLayout>; // keyed by "schema.table"
}

interface TableLayout {
  x: number;
  y: number;
  collapsed?: boolean;
  color?: string;
}
```

### Layout rules

- **Keyed by stable identity** (`schema.table`) so it survives reformatting and member
  reordering of the SQL.
- A table **not present** in the file is auto-placed by the ELK layout engine on first
  render; its position is then written back.
- **Committed to Git** (not git-ignored): shared diagrams are part of the tool's value,
  and JSON keeps layout changes diffable and reviewable.
- Renames: when a table is renamed, its layout entry should be migrated to the new key as
  part of the rename edit so the position is not lost.

## Source-of-truth invariant

`ProjectModel` can always be reconstructed by re-parsing the `.sql` files. The layout
sidecar holds the only persistent, non-derivable state. There is deliberately **no
database** and no other schema cache — see
[ADR-0004](decisions/ADR-0004-in-memory-model-no-sqlite.md).
