/**
 * Registered edit operations — single dispatch point for host and verify runners.
 */

import type { ProjectModel } from "../model.ts";
import { prepareAddColumn } from "./addColumn.ts";
import { prepareAddForeignKey } from "./addForeignKey.ts";
import { prepareRemoveColumn } from "./removeColumn.ts";
import { prepareChangeColumn } from "./changeColumn.ts";
import { prepareRenameColumn } from "./renameColumn.ts";
import type {
  AddColumnParams,
  AddForeignKeyParams,
  ChangeColumnParams,
  EditValidationResult,
  RemoveColumnParams,
  RenameColumnParams,
} from "./types.ts";

export type EditOperationId =
  | "addForeignKey"
  | "addColumn"
  | "removeColumn"
  | "renameColumn"
  | "changeColumn";

export type EditIntentMap = {
  addForeignKey: AddForeignKeyParams;
  addColumn: AddColumnParams;
  removeColumn: RemoveColumnParams;
  renameColumn: RenameColumnParams;
  changeColumn: ChangeColumnParams;
};

export interface EditOperation<K extends EditOperationId = EditOperationId> {
  id: K;
  prepare(model: ProjectModel, intent: EditIntentMap[K]): EditValidationResult;
  previewTitle(intent: EditIntentMap[K]): string;
}

export const editOperations: { [K in EditOperationId]: EditOperation<K> } = {
  addForeignKey: {
    id: "addForeignKey",
    prepare: prepareAddForeignKey,
    previewTitle: (intent) =>
      `Add FK ${intent.fromTableKey}.${intent.fromColumn} → ${intent.toTableKey}.${intent.toColumn}`,
  },
  addColumn: {
    id: "addColumn",
    prepare: prepareAddColumn,
    previewTitle: (intent) => `Add column ${intent.tableKey}.${intent.columnName}`,
  },
  removeColumn: {
    id: "removeColumn",
    prepare: prepareRemoveColumn,
    previewTitle: (intent) => `Remove column ${intent.tableKey}.${intent.columnName}`,
  },
  renameColumn: {
    id: "renameColumn",
    prepare: prepareRenameColumn,
    previewTitle: (intent) =>
      `Rename column ${intent.tableKey}.${intent.oldName} → ${intent.newName}`,
  },
  changeColumn: {
    id: "changeColumn",
    prepare: prepareChangeColumn,
    previewTitle: (intent) =>
      `Change column ${intent.tableKey}.${intent.columnName} → ${intent.dataType} ${intent.nullable ? "NULL" : "NOT NULL"}`,
  },
};

export function prepareEdit<K extends EditOperationId>(
  id: K,
  model: ProjectModel,
  intent: EditIntentMap[K],
): EditValidationResult {
  return editOperations[id].prepare(model, intent);
}

export function editPreviewTitle<K extends EditOperationId>(
  id: K,
  intent: EditIntentMap[K],
): string {
  return editOperations[id].previewTitle(intent);
}
