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
  /**
   * Insert the new column immediately before this existing column. When omitted
   * (or not found), the column is placed after all columns but before constraints
   * (C5 — columns precede constraints).
   */
  beforeColumnName?: string;
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

export interface EditCommentParams {
  tableKey: string;
  columnName: string;
  /** New trailing comment text; empty/whitespace removes the comment. */
  comment: string;
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

/**
 * Single source of truth mapping each edit operation id to its intent params.
 * The registry, host dispatch, and wire protocol all derive from this so adding
 * an operation here forces every consumer to handle it.
 */
export interface EditIntentMap {
  addForeignKey: AddForeignKeyParams;
  addColumn: AddColumnParams;
  removeColumn: RemoveColumnParams;
  renameColumn: RenameColumnParams;
  changeColumn: ChangeColumnParams;
  editComment: EditCommentParams;
  addTable: AddTableParams;
  dropTable: DropTableParams;
  renameTable: RenameTableParams;
}

export type EditOperationId = keyof EditIntentMap;

/**
 * Edit operations that can be collected into an inline draft and applied as a
 * single batch (one combined diff). Table-level ops (add/drop/rename table) stay
 * on the single-intent path because they create/delete files.
 */
export type DraftableOperationId =
  | "addColumn"
  | "removeColumn"
  | "renameColumn"
  | "changeColumn"
  | "editComment"
  | "addForeignKey";

/** `{ type: "addColumn"; intent: AddColumnParams } | …` for each draftable op. */
export type DraftOp = {
  [K in DraftableOperationId]: { type: K; intent: EditIntentMap[K] };
}[DraftableOperationId];
