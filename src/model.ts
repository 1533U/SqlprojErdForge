/**
 * In-memory schema model for the Phase 0 spike.
 *
 * Mirrors docs/05-data-model.md, with two documented extensions:
 *  - `Column.generatedAs` + the `PeriodForSystemTime` member (ADR-0012, temporal tables).
 *  - `Table.readOnly` (ADR-0011, Syspro mirror tables) and `Table.roundTrippable`
 *    (ADR-0012, files with un-modeled post-`GO` content are not rewritten).
 *
 * The model is derived from the `.sql` files and is disposable; the files remain the
 * single source of truth.
 */

export interface ProjectModel {
  /** Absolute path to the .sqlproj. */
  projectPath: string;
  /** Tables keyed by fully-qualified name, e.g. "dbo.Customer". */
  tables: Map<string, Table>;
  /** Parse diagnostics for files/tables that violated the conventions. */
  diagnostics: Diagnostic[];
}

export interface Table {
  schema: string;
  name: string;
  /** Source file this table was parsed from, e.g. "dbo.Customer.sql". */
  sourceFile: string;
  /** Columns, constraints and period members in *source order* (never reordered). */
  members: Member[];
  headerComments?: string[];
  footerComments?: string[];
  /** ADR-0011: machine-exported mirror table; never edited or rewritten. */
  readOnly: boolean;
  /**
   * ADR-0012: false when the source file has un-modeled content (e.g. statements after
   * `GO`), so the tool must not rewrite the whole file. The table is still modeled.
   */
  roundTrippable: boolean;
}

export type Member = Column | Constraint | PeriodForSystemTime;

export type GeneratedAs = "rowStart" | "rowEnd";

export interface Column {
  kind: "column";
  name: string;
  /** Canonical text, e.g. "NVARCHAR(100)", "DECIMAL(18, 2)". */
  dataType: string;
  nullable: boolean;
  identity?: { seed: number; increment: number };
  /** Raw default expression, e.g. "(GETUTCDATE())". */
  default?: string;
  /** Raw computed expression, if a computed column (`col AS expr`). */
  computed?: string;
  /** ADR-0015: PERSISTED flag on a computed column. */
  persisted?: boolean;
  /** Collation name, e.g. "Latin1_General_BIN". */
  collate?: string;
  /** ADR-0012: temporal system-versioning column. */
  generatedAs?: GeneratedAs;
  /**
   * ADR-0015: inline (nameless) column-level CHECK expressions, in source order,
   * preserved verbatim (canonically rendered), e.g. "([x]='Y' OR [x]='N')".
   */
  checks?: string[];
  /** ADR-0015: inline `PRIMARY KEY` on the column definition. */
  primaryKeyInline?: boolean;
  /** ADR-0015: inline `UNIQUE` on the column definition. */
  uniqueInline?: boolean;
  /** ADR-0015: `ROWGUIDCOL` storage attribute. */
  rowguidcol?: boolean;
  /** ADR-0015: `FILESTREAM` storage attribute. */
  filestream?: boolean;
  leadingComments?: string[];
  trailingComment?: string;
}

/** ADR-0012: `PERIOD FOR SYSTEM_TIME (startColumn, endColumn)`. */
export interface PeriodForSystemTime {
  kind: "period";
  startColumn: string;
  endColumn: string;
  leadingComments?: string[];
  trailingComment?: string;
}

export type Constraint =
  | PrimaryKeyConstraint
  | ForeignKeyConstraint
  | UniqueConstraint
  | CheckConstraint;

export interface ConstraintBase {
  kind: "constraint";
  name: string;
  leadingComments?: string[];
  trailingComment?: string;
}

export interface PrimaryKeyConstraint extends ConstraintBase {
  constraintType: "primaryKey";
  columns: string[];
}

export interface ForeignKeyConstraint extends ConstraintBase {
  constraintType: "foreignKey";
  columns: string[];
  references: {
    schema?: string;
    table: string;
    columns: string[];
  };
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
}

export interface UniqueConstraint extends ConstraintBase {
  constraintType: "unique";
  columns: string[];
}

export interface CheckConstraint extends ConstraintBase {
  constraintType: "check";
  expression: string;
}

export type ReferentialAction = "noAction" | "cascade" | "setNull" | "setDefault";

export interface Diagnostic {
  file: string;
  line: number;
  column?: number;
  severity: "error" | "warning";
  message: string;
}

/** ERD edge derived only from a declared FK constraint (C10 / ADR-0008). */
export interface Edge {
  from: string; // "schema.table"
  to: string; // "schema.table" (schema may be defaulted)
  constraintName: string;
  columns: string[];
  referencedColumns: string[];
}

/** Exhaustiveness helper for switch statements over discriminated unions. */
export function assertNever(value: never): never {
  throw new Error(`Unexpected variant: ${JSON.stringify(value)}`);
}
