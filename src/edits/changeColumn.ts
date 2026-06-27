/**
 * Change a column's data type and/or nullability (P3-4).
 */

import type { ProjectModel, Table } from "../model.ts";
import { buildFileEditCandidate } from "./candidate.ts";
import { cloneProjectModel } from "./cloneModel.ts";
import {
  columnTypeChangeBlockReason,
  findColumn,
  validateEditableTable,
} from "./memberChecks.ts";
import type { ChangeColumnParams, EditValidationResult } from "./types.ts";

export function prepareChangeColumn(
  model: ProjectModel,
  params: ChangeColumnParams,
): EditValidationResult {
  const validation = validateChangeColumn(model, params);
  if (!validation.ok) return validation;

  const mutated = cloneProjectModel(model);
  const table = mutated.tables.get(params.tableKey);
  if (!table) {
    return { ok: false, message: `Table not found: ${params.tableKey}` };
  }

  applyChangeColumnMutation(table, params);
  return buildFileEditCandidate(model, table, params.tableKey);
}

export function applyChangeColumnToModel(
  model: ProjectModel,
  params: ChangeColumnParams,
): ProjectModel {
  const validation = validateChangeColumn(model, params);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const mutated = cloneProjectModel(model);
  const table = mutated.tables.get(params.tableKey);
  if (!table) {
    throw new Error(`Table not found: ${params.tableKey}`);
  }

  applyChangeColumnMutation(table, params);
  return mutated;
}

function applyChangeColumnMutation(table: Table, params: ChangeColumnParams): void {
  const column = findColumn(table, params.columnName.trim());
  if (!column) {
    throw new Error(`Column ${params.columnName} not found.`);
  }

  column.dataType = params.dataType.trim();
  column.nullable = params.nullable;
}

function validateChangeColumn(
  model: ProjectModel,
  params: ChangeColumnParams,
): EditValidationResult | { ok: true } {
  const columnName = params.columnName.trim();
  if (!columnName) {
    return { ok: false, message: "Column name is required." };
  }

  const dataType = params.dataType.trim();
  if (!dataType) {
    return { ok: false, message: "Data type is required." };
  }

  const tableResult = validateEditableTable(model.tables.get(params.tableKey), params.tableKey);
  if (!tableResult.ok) return tableResult;

  const column = findColumn(tableResult.table, columnName);
  if (!column) {
    return {
      ok: false,
      message: `Column ${columnName} not found on ${params.tableKey}.`,
    };
  }

  if (column.dataType === dataType && column.nullable === params.nullable) {
    return {
      ok: false,
      message: "Data type and nullability are unchanged.",
    };
  }

  const blockReason = columnTypeChangeBlockReason(
    model,
    params.tableKey,
    columnName,
    params.nullable,
  );
  if (blockReason) {
    return { ok: false, message: blockReason };
  }

  return { ok: true };
}
