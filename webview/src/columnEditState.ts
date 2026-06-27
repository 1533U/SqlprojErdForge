/**
 * Column-row selection/highlight state for edit modes in TableNode.
 */

import type { ColumnRef, EditMode, GraphColumn } from "./types";

export interface ColumnRowEditState {
  isSelectable: boolean;
  isFkSource: boolean;
  isFkTarget: boolean;
  isRemoveTarget: boolean;
  isRemoveBlocked: boolean;
  isRenameTarget: boolean;
}

export function computeColumnRowEditState(
  editMode: EditMode,
  readOnly: boolean,
  fkSource: ColumnRef | undefined,
  removeColumnTarget: ColumnRef | undefined,
  renameColumnTarget: ColumnRef | undefined,
  tableKey: string,
  column: GraphColumn,
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
  const isRemoveBlocked =
    editMode === "removeColumn" && (column.isPrimaryKey || column.isForeignKey);
  const isFkSelectable =
    editMode === "addFk" &&
    (!readOnly || fkSource != null) &&
    (fkSource == null ? !readOnly : isFkTarget || isFkSource);
  const isRemoveSelectable =
    editMode === "removeColumn" && !readOnly && !isRemoveBlocked;
  const isRenameSelectable = editMode === "renameColumn" && !readOnly;

  return {
    isSelectable: isFkSelectable || isRemoveSelectable || isRenameSelectable,
    isFkSource,
    isFkTarget,
    isRemoveTarget,
    isRemoveBlocked,
    isRenameTarget,
  };
}
