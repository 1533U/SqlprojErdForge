/**
 * Registered edit operations — single dispatch point for host and verify runners.
 */

import type { ProjectModel } from "../model.ts";
import { splitTableKey } from "./memberChecks.ts";
import { prepareAddColumn } from "./addColumn.ts";
import { prepareAddForeignKey } from "./addForeignKey.ts";
import { prepareAddTable } from "./addTable.ts";
import { prepareRemoveColumn } from "./removeColumn.ts";
import { prepareChangeColumn } from "./changeColumn.ts";
import { prepareDropTable } from "./dropTable.ts";
import { prepareRenameColumn } from "./renameColumn.ts";
import { prepareRenameTable } from "./renameTable.ts";
import type {
  AddColumnParams,
  AddForeignKeyParams,
  AddTableParams,
  ChangeColumnParams,
  DropTableParams,
  EditValidationResult,
  RemoveColumnParams,
  RenameColumnParams,
  RenameTableParams,
} from "./types.ts";

export type EditOperationId =
  | "addForeignKey"
  | "addColumn"
  | "removeColumn"
  | "renameColumn"
  | "changeColumn"
  | "addTable"
  | "dropTable"
  | "renameTable";

export type EditIntentMap = {
  addForeignKey: AddForeignKeyParams;
  addColumn: AddColumnParams;
  removeColumn: RemoveColumnParams;
  renameColumn: RenameColumnParams;
  changeColumn: ChangeColumnParams;
  addTable: AddTableParams;
  dropTable: DropTableParams;
  renameTable: RenameTableParams;
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
  addTable: {
    id: "addTable",
    prepare: prepareAddTable,
    previewTitle: (intent) =>
      `Add table ${intent.schema.trim()}.${intent.tableName.trim()}`,
  },
  dropTable: {
    id: "dropTable",
    prepare: prepareDropTable,
    previewTitle: (intent) => `Drop table ${intent.tableKey.trim()}`,
  },
  renameTable: {
    id: "renameTable",
    prepare: prepareRenameTable,
    previewTitle: (intent) => {
      const [schema] = splitTableKey(intent.tableKey.trim());
      const newSchema = intent.newSchema?.trim() ?? schema;
      const newName = intent.newTableName.trim();
      return `Rename table ${intent.tableKey.trim()} → ${newSchema}.${newName}`;
    },
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
