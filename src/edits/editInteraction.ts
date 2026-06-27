/**
 * Pure edit-mode interaction rules shared by webview selection UX and row highlighting.
 */

import { splitTableKey, tableKeyFromParts, validateSchemaName, validateTableName } from "./memberChecks.ts";

export interface ColumnRef {
  tableKey: string;
  columnName: string;
}

export type EditMode =
  | "none"
  | "addFk"
  | "addColumn"
  | "removeColumn"
  | "renameColumn"
  | "changeColumn"
  | "addTable"
  | "dropTable"
  | "renameTable";

export interface GraphColumnView {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface GraphTableView {
  key: string;
  readOnly: boolean;
  columns: GraphColumnView[];
}

export function readOnlyTableMessage(tableKey: string, context?: "column" | "table"): string {
  if (context === "table") {
    return `${tableKey} is read-only — choose an editable table.`;
  }
  return `${tableKey} is read-only.`;
}

export function selectTableForAddColumn(
  table: GraphTableView | undefined,
  tableKey: string,
): { ok: true; tableKey: string } | { ok: false; message: string } {
  if (!table) {
    return { ok: true, tableKey };
  }
  if (table.readOnly) {
    return { ok: false, message: readOnlyTableMessage(tableKey, "table") };
  }
  return { ok: true, tableKey };
}

export function validateAddTableForm(
  tables: GraphTableView[],
  schema: string,
  tableName: string,
): { ok: true; tableKey: string } | { ok: false; message: string } {
  const schemaResult = validateSchemaName(schema);
  if (!schemaResult.ok) return schemaResult;

  const tableResult = validateTableName(tableName);
  if (!tableResult.ok) return tableResult;

  const tableKey = tableKeyFromParts(schema, tableName);
  if (tables.some((table) => table.key === tableKey)) {
    return { ok: false, message: `Table ${tableKey} already exists in the project.` };
  }

  return { ok: true, tableKey };
}

export function selectTableForDrop(
  table: GraphTableView | undefined,
  tableKey: string,
): { ok: true; tableKey: string } | { ok: false; message: string } {
  if (!table) {
    return { ok: false, message: `Table not found: ${tableKey}.` };
  }
  if (table.readOnly) {
    return { ok: false, message: readOnlyTableMessage(tableKey, "table") };
  }
  return { ok: true, tableKey };
}

export function selectTableForRename(
  table: GraphTableView | undefined,
  tableKey: string,
): { ok: true; tableKey: string; schema: string; tableName: string } | { ok: false; message: string } {
  if (!table) {
    return { ok: false, message: `Table not found: ${tableKey}.` };
  }
  if (table.readOnly) {
    return { ok: false, message: readOnlyTableMessage(tableKey, "table") };
  }
  const [schema, tableName] = splitTableKey(tableKey);
  return { ok: true, tableKey, schema, tableName };
}

export function validateRenameTableForm(
  tables: GraphTableView[],
  tableKey: string,
  newSchema: string,
  newTableName: string,
): { ok: true } | { ok: false; message: string } {
  const schemaResult = validateSchemaName(newSchema);
  if (!schemaResult.ok) return schemaResult;

  const tableResult = validateTableName(newTableName);
  if (!tableResult.ok) return tableResult;

  const [oldSchema, oldTableName] = splitTableKey(tableKey);
  const trimmedSchema = newSchema.trim();
  const trimmedName = newTableName.trim();
  if (oldSchema === trimmedSchema && oldTableName === trimmedName) {
    return { ok: false, message: "New table name must differ from the current name." };
  }

  const newKey = tableKeyFromParts(trimmedSchema, trimmedName);
  if (tables.some((table) => table.key === newKey)) {
    return { ok: false, message: `Table ${newKey} already exists in the project.` };
  }

  return { ok: true };
}

export interface GraphEdgeView {
  from: string;
  to: string;
  label: string;
}

export function inboundFkWarningForDrop(
  edges: GraphEdgeView[],
  tableKey: string,
): string | undefined {
  const refs = edges.filter((edge) => edge.to === tableKey);
  if (refs.length === 0) return undefined;

  const detail = refs.map((edge) => `${edge.from} (${edge.label})`).join(", ");
  return `${refs.length} foreign key(s) reference this table: ${detail}.`;
}

export interface FkSelectionState {
  fkSource: ColumnRef | undefined;
  fkTarget: ColumnRef | undefined;
}

export type FkColumnSelectResult =
  | { ok: true; fkSource: ColumnRef; fkTarget: undefined }
  | { ok: true; fkSource: ColumnRef; fkTarget: ColumnRef }
  | { ok: false; message: string };

export function selectColumnForAddFk(
  table: GraphTableView,
  column: GraphColumnView,
  current: FkSelectionState,
): FkColumnSelectResult {
  const tableKey = table.key;
  const columnName = column.name;

  if (current.fkSource == null) {
    if (table.readOnly) {
      return { ok: false, message: readOnlyTableMessage(tableKey, "table") };
    }
    return {
      ok: true,
      fkSource: { tableKey, columnName },
      fkTarget: undefined,
    };
  }

  if (tableKey === current.fkSource.tableKey) {
    return {
      ok: true,
      fkSource: { tableKey, columnName },
      fkTarget: undefined,
    };
  }

  if (!column.isPrimaryKey) {
    return { ok: false, message: "Referenced column must be a primary key." };
  }

  return {
    ok: true,
    fkSource: current.fkSource,
    fkTarget: { tableKey, columnName },
  };
}

export function selectColumnForRemove(
  table: GraphTableView,
  column: GraphColumnView,
): { ok: true; target: ColumnRef } | { ok: false; message: string } {
  if (table.readOnly) {
    return { ok: false, message: readOnlyTableMessage(table.key) };
  }
  if (column.isPrimaryKey || column.isForeignKey) {
    return { ok: false, message: "Cannot remove a PK or FK column." };
  }
  return { ok: true, target: { tableKey: table.key, columnName: column.name } };
}

export function selectColumnForRename(
  table: GraphTableView,
  columnName: string,
): { ok: true; target: ColumnRef } | { ok: false; message: string } {
  if (table.readOnly) {
    return { ok: false, message: readOnlyTableMessage(table.key) };
  }
  return { ok: true, target: { tableKey: table.key, columnName } };
}

export function selectColumnForChangeColumn(
  table: GraphTableView,
  column: GraphColumnView,
): { ok: true; target: ColumnRef; dataType: string; nullable: boolean } | { ok: false; message: string } {
  if (table.readOnly) {
    return { ok: false, message: readOnlyTableMessage(table.key) };
  }
  return {
    ok: true,
    target: { tableKey: table.key, columnName: column.name },
    dataType: column.dataType,
    nullable: column.nullable,
  };
}

export interface ColumnRowEditState {
  isSelectable: boolean;
  isFkSource: boolean;
  isFkTarget: boolean;
  isRemoveTarget: boolean;
  isRemoveBlocked: boolean;
  isRenameTarget: boolean;
  isChangeColumnTarget: boolean;
}

export function computeColumnRowEditState(
  editMode: EditMode,
  readOnly: boolean,
  fkSource: ColumnRef | undefined,
  removeColumnTarget: ColumnRef | undefined,
  renameColumnTarget: ColumnRef | undefined,
  changeColumnTarget: ColumnRef | undefined,
  tableKey: string,
  column: GraphColumnView,
): ColumnRowEditState {
  const isFkSource =
    editMode === "addFk" &&
    fkSource?.tableKey === tableKey &&
    fkSource.columnName === column.name;
  const isFkTarget =
    editMode === "addFk" &&
    fkSource != null &&
    !isFkSource &&
    column.isPrimaryKey;
  const isRemoveTarget =
    editMode === "removeColumn" &&
    removeColumnTarget?.tableKey === tableKey &&
    removeColumnTarget.columnName === column.name;
  const isRenameTarget =
    editMode === "renameColumn" &&
    renameColumnTarget?.tableKey === tableKey &&
    renameColumnTarget.columnName === column.name;
  const isChangeColumnTarget =
    editMode === "changeColumn" &&
    changeColumnTarget?.tableKey === tableKey &&
    changeColumnTarget.columnName === column.name;
  const isRemoveBlocked =
    editMode === "removeColumn" && (column.isPrimaryKey || column.isForeignKey);
  const isFkSelectable =
    editMode === "addFk" &&
    (!readOnly || fkSource != null) &&
    (fkSource == null ? !readOnly : isFkTarget || isFkSource);
  const isRemoveSelectable =
    editMode === "removeColumn" && !readOnly && !isRemoveBlocked;
  const isRenameSelectable = editMode === "renameColumn" && !readOnly;
  const isChangeColumnSelectable = editMode === "changeColumn" && !readOnly;

  return {
    isSelectable:
      isFkSelectable || isRemoveSelectable || isRenameSelectable || isChangeColumnSelectable,
    isFkSource,
    isFkTarget,
    isRemoveTarget,
    isRemoveBlocked,
    isRenameTarget,
    isChangeColumnTarget,
  };
}
