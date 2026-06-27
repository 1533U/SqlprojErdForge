/**
 * Add a column to one table (P3-2a).
 */

import type { Column, ProjectModel, Table } from "../model.ts";
import { buildFileEditCandidate } from "./candidate.ts";
import { cloneProjectModel } from "./cloneModel.ts";
import {
  findColumn,
  insertIndexForNewColumn,
  validateColumnName,
  validateEditableTable,
} from "./memberChecks.ts";
import type { AddColumnParams, EditValidationResult } from "./types.ts";

export function prepareAddColumn(
  model: ProjectModel,
  params: AddColumnParams,
): EditValidationResult {
  const validation = validateAddColumn(model, params);
  if (!validation.ok) return validation;

  const mutated = cloneProjectModel(model);
  const table = mutated.tables.get(params.tableKey);
  if (!table) {
    return { ok: false, message: `Table not found: ${params.tableKey}` };
  }

  applyAddColumnMutation(table, params);
  return buildFileEditCandidate(model, table, params.tableKey);
}

export function applyAddColumnToModel(model: ProjectModel, params: AddColumnParams): ProjectModel {
  const validation = validateAddColumn(model, params);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const mutated = cloneProjectModel(model);
  const table = mutated.tables.get(params.tableKey);
  if (!table) {
    throw new Error(`Table not found: ${params.tableKey}`);
  }

  applyAddColumnMutation(table, params);
  return mutated;
}

function applyAddColumnMutation(table: Table, params: AddColumnParams): void {
  const column: Column = {
    kind: "column",
    name: params.columnName.trim(),
    dataType: params.dataType.trim(),
    nullable: params.nullable,
    ...(params.trailingComment?.trim()
      ? { trailingComment: params.trailingComment.trim() }
      : {}),
  };
  table.members.splice(insertIndexForNewColumn(table), 0, column);
}

function validateAddColumn(
  model: ProjectModel,
  params: AddColumnParams,
): EditValidationResult | { ok: true } {
  const tableResult = validateEditableTable(model.tables.get(params.tableKey), params.tableKey);
  if (!tableResult.ok) return tableResult;

  const nameResult = validateColumnName(params.columnName);
  if (!nameResult.ok) return nameResult;

  const columnName = params.columnName.trim();
  if (findColumn(tableResult.table, columnName)) {
    return {
      ok: false,
      message: `Column ${columnName} already exists on ${params.tableKey}.`,
    };
  }

  const dataType = params.dataType.trim();
  if (!dataType) {
    return { ok: false, message: "Data type is required." };
  }

  return { ok: true };
}
