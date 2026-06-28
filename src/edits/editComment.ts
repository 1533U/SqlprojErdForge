/**
 * Edit (set, change, or clear) a column's trailing comment (P4-5).
 */

import type { ProjectModel, Table } from "../model.ts";
import { buildFileEditCandidate } from "./candidate.ts";
import { cloneProjectModel } from "./cloneModel.ts";
import { findColumn, validateEditableTable } from "./memberChecks.ts";
import type { EditCommentParams, EditValidationResult } from "./types.ts";

export function prepareEditComment(
  model: ProjectModel,
  params: EditCommentParams,
): EditValidationResult {
  const validation = validateEditComment(model, params);
  if (!validation.ok) return validation;

  const mutated = cloneProjectModel(model);
  const table = mutated.tables.get(params.tableKey);
  if (!table) {
    return { ok: false, message: `Table not found: ${params.tableKey}` };
  }

  applyEditCommentMutation(table, params);
  return buildFileEditCandidate(model, table, params.tableKey);
}

export function applyEditCommentToModel(
  model: ProjectModel,
  params: EditCommentParams,
): ProjectModel {
  const validation = validateEditComment(model, params);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const mutated = cloneProjectModel(model);
  const table = mutated.tables.get(params.tableKey);
  if (!table) {
    throw new Error(`Table not found: ${params.tableKey}`);
  }

  applyEditCommentMutation(table, params);
  return mutated;
}

function applyEditCommentMutation(table: Table, params: EditCommentParams): void {
  const column = findColumn(table, params.columnName.trim());
  if (!column) {
    throw new Error(`Column ${params.columnName} not found.`);
  }

  const comment = params.comment.trim();
  if (comment) {
    column.trailingComment = comment;
  } else {
    delete column.trailingComment;
  }
}

function validateEditComment(
  model: ProjectModel,
  params: EditCommentParams,
): EditValidationResult | { ok: true } {
  const columnName = params.columnName.trim();
  if (!columnName) {
    return { ok: false, message: "Column name is required." };
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

  const next = params.comment.trim();
  const current = column.trailingComment?.trim() ?? "";
  if (next === current) {
    return { ok: false, message: "Comment is unchanged." };
  }

  return { ok: true };
}
