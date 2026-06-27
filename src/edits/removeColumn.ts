/**
 * Remove a column from one table (P3-2b).
 */

import type { ProjectModel, Table } from "../model.ts";
import { buildFileEditCandidate } from "./candidate.ts";
import { cloneProjectModel } from "./cloneModel.ts";
import {
  columnPkFkBlockReason,
  findColumn,
  validateEditableTable,
} from "./memberChecks.ts";
import type { EditValidationResult, RemoveColumnParams } from "./types.ts";

export function prepareRemoveColumn(
  model: ProjectModel,
  params: RemoveColumnParams,
): EditValidationResult {
  const validation = validateRemoveColumn(model, params);
  if (!validation.ok) return validation;

  const mutated = cloneProjectModel(model);
  const table = mutated.tables.get(params.tableKey);
  if (!table) {
    return { ok: false, message: `Table not found: ${params.tableKey}` };
  }

  applyRemoveColumnMutation(table, params);
  return buildFileEditCandidate(model, table, params.tableKey);
}

export function applyRemoveColumnToModel(
  model: ProjectModel,
  params: RemoveColumnParams,
): ProjectModel {
  const validation = validateRemoveColumn(model, params);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const mutated = cloneProjectModel(model);
  const table = mutated.tables.get(params.tableKey);
  if (!table) {
    throw new Error(`Table not found: ${params.tableKey}`);
  }

  applyRemoveColumnMutation(table, params);
  return mutated;
}

function applyRemoveColumnMutation(table: Table, params: RemoveColumnParams): void {
  const columnName = params.columnName.trim();
  table.members = table.members.filter(
    (m) => !(m.kind === "column" && m.name === columnName),
  );
}

function validateRemoveColumn(
  model: ProjectModel,
  params: RemoveColumnParams,
): EditValidationResult | { ok: true } {
  const columnName = params.columnName.trim();
  if (!columnName) {
    return { ok: false, message: "Column name is required." };
  }

  const tableResult = validateEditableTable(model.tables.get(params.tableKey), params.tableKey);
  if (!tableResult.ok) return tableResult;

  if (!findColumn(tableResult.table, columnName)) {
    return {
      ok: false,
      message: `Column ${columnName} not found on ${params.tableKey}.`,
    };
  }

  const blockReason = columnPkFkBlockReason(model, params.tableKey, columnName);
  if (blockReason) {
    return { ok: false, message: blockReason };
  }

  return { ok: true };
}
