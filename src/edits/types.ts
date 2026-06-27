/**
 * Edit pipeline types (Phase 3 / docs/06-edit-ux.md).
 */

export interface AddForeignKeyParams {
  /** Fully-qualified table that receives the FK constraint, e.g. "dbo.pr_buying_season". */
  fromTableKey: string;
  fromColumn: string;
  /** Fully-qualified referenced table, e.g. "dbo.pr_port". */
  toTableKey: string;
  toColumn: string;
  constraintName: string;
}

export interface AddColumnParams {
  tableKey: string;
  columnName: string;
  dataType: string;
  nullable: boolean;
  trailingComment?: string;
}

export interface RemoveColumnParams {
  tableKey: string;
  columnName: string;
}

export interface RenameColumnParams {
  tableKey: string;
  oldName: string;
  newName: string;
}

export interface ChangeColumnParams {
  tableKey: string;
  columnName: string;
  dataType: string;
  nullable: boolean;
}

export interface AddTableParams {
  schema: string;
  tableName: string;
  /** Relative folder for the build item, e.g. "purple". Empty = project root. */
  includeFolder?: string;
  layoutX?: number;
  layoutY?: number;
}

export interface DropTableParams {
  tableKey: string;
}

export interface RenameTableParams {
  tableKey: string;
  newTableName: string;
  /** When omitted, the table keeps its current schema. */
  newSchema?: string;
}

export interface FileEditCandidate {
  /** Absolute path to the on-disk .sql file. */
  absPath: string;
  /** Build-item include path as stored on the table model. */
  sourceFile: string;
  /** Current file content read from disk. */
  originalContent: string;
  /** Canonical emit of the mutated table model. */
  candidateContent: string;
  /** Content hash at preview time — used to detect conflicts on apply. */
  originalRevision: string;
  /** When true, apply creates the file instead of replacing existing content. */
  isNewFile?: boolean;
  /** When true, apply deletes the file instead of replacing content. */
  isDeleteFile?: boolean;
  /**
   * Links a delete candidate to its create counterpart for atomic `renameFile` apply
   * (rename table). Both sides of the pair share the same key.
   */
  renamePairKey?: string;
}

export type EditValidationResult =
  | { ok: true; candidates: FileEditCandidate[] }
  | { ok: false; message: string };
