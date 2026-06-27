/**
 * Rename a column and propagate the new name to PK/FK/PERIOD/inbound REFERENCES (P3-3).
 */

import { assertNever } from "../model.ts";
import type { ProjectModel, Table } from "../model.ts";
import { buildFileEditCandidates } from "./candidate.ts";
import { cloneProjectModel } from "./cloneModel.ts";
import {
  findColumn,
  findInboundFkReferences,
  replaceColumnNameInList,
  splitTableKey,
  validateColumnName,
  validateEditableTable,
} from "./memberChecks.ts";
import type { EditValidationResult, RenameColumnParams } from "./types.ts";

export function prepareRenameColumn(
  model: ProjectModel,
  params: RenameColumnParams,
): EditValidationResult {
  const validation = validateRenameColumn(model, params);
  if (!validation.ok) return validation;

  const mutated = cloneProjectModel(model);
  const touchedKeys = applyRenameColumnMutation(mutated, params);
  return buildFileEditCandidates(model, mutated, touchedKeys, params.tableKey);
}

export function applyRenameColumnToModel(
  model: ProjectModel,
  params: RenameColumnParams,
): ProjectModel {
  const validation = validateRenameColumn(model, params);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const mutated = cloneProjectModel(model);
  applyRenameColumnMutation(mutated, params);
  return mutated;
}

export function applyRenameColumnMutation(
  model: ProjectModel,
  params: RenameColumnParams,
): Set<string> {
  const oldName = params.oldName.trim();
  const newName = params.newName.trim();
  const tableKey = params.tableKey;
  const table = model.tables.get(tableKey);
  if (!table) {
    throw new Error(`Table not found: ${tableKey}`);
  }

  const touched = new Set<string>([tableKey]);
  renameColumnOnTable(table, oldName, newName);
  propagateInboundFkReferenceRenames(model, tableKey, oldName, newName, touched);
  return touched;
}

function renameColumnOnTable(table: Table, oldName: string, newName: string): void {
  for (const member of table.members) {
    if (member.kind === "column" && member.name === oldName) {
      member.name = newName;
    }
  }

  for (const member of table.members) {
    switch (member.kind) {
      case "column":
        break;
      case "period":
        if (member.startColumn === oldName) member.startColumn = newName;
        if (member.endColumn === oldName) member.endColumn = newName;
        break;
      case "constraint":
        switch (member.constraintType) {
          case "primaryKey":
          case "unique":
            replaceColumnNameInList(member.columns, oldName, newName);
            break;
          case "foreignKey":
            replaceColumnNameInList(member.columns, oldName, newName);
            break;
          case "check":
            break;
          default:
            assertNever(member);
        }
        break;
      default:
        assertNever(member);
    }
  }
}

function propagateInboundFkReferenceRenames(
  model: ProjectModel,
  tableKey: string,
  oldName: string,
  newName: string,
  touched: Set<string>,
): void {
  const [schema, tableName] = splitTableKey(tableKey);

  for (const [fromKey, fromTable] of model.tables) {
    if (fromKey === tableKey) continue;

    let fromTableTouched = false;
    for (const member of fromTable.members) {
      if (member.kind !== "constraint" || member.constraintType !== "foreignKey") continue;
      const refSchema = member.references.schema ?? "dbo";
      if (refSchema !== schema || member.references.table !== tableName) continue;
      if (replaceColumnNameInList(member.references.columns, oldName, newName)) {
        fromTableTouched = true;
      }
    }

    if (fromTableTouched) {
      touched.add(fromKey);
    }
  }
}

function validateRenameColumn(
  model: ProjectModel,
  params: RenameColumnParams,
): EditValidationResult | { ok: true } {
  const oldName = params.oldName.trim();
  const newName = params.newName.trim();

  if (!oldName) {
    return { ok: false, message: "Column name is required." };
  }

  const nameResult = validateColumnName(newName);
  if (!nameResult.ok) return nameResult;

  if (oldName === newName) {
    return { ok: false, message: "New column name must differ from the current name." };
  }

  const tableResult = validateEditableTable(model.tables.get(params.tableKey), params.tableKey);
  if (!tableResult.ok) return tableResult;

  if (!findColumn(tableResult.table, oldName)) {
    return {
      ok: false,
      message: `Column ${oldName} not found on ${params.tableKey}.`,
    };
  }

  if (findColumn(tableResult.table, newName)) {
    return {
      ok: false,
      message: `Column ${newName} already exists on ${params.tableKey}.`,
    };
  }

  for (const inbound of findInboundFkReferences(model, params.tableKey, oldName)) {
    const refTableResult = validateEditableTable(
      model.tables.get(inbound.fromTableKey),
      inbound.fromTableKey,
    );
    if (!refTableResult.ok) {
      return {
        ok: false,
        message: `${refTableResult.message} (references ${params.tableKey}.${oldName} via ${inbound.constraintName}).`,
      };
    }
  }

  return { ok: true };
}
