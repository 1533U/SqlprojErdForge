/**
 * Add a declared FOREIGN KEY constraint to one table (P3-1).
 */

import type {
  Constraint,
  ForeignKeyConstraint,
  Member,
  ProjectModel,
  Table,
} from "../model.ts";
import { assertNever } from "../model.ts";
import { buildFileEditCandidate } from "./candidate.ts";
import { cloneProjectModel } from "./cloneModel.ts";
import {
  findColumn,
  splitTableKey,
  validateEditableTable,
} from "./memberChecks.ts";
import { suggestForeignKeyName } from "./naming.ts";
import type { AddForeignKeyParams, EditValidationResult } from "./types.ts";

export { suggestForeignKeyName };

export function prepareAddForeignKey(
  model: ProjectModel,
  params: AddForeignKeyParams,
): EditValidationResult {
  const validation = validateAddForeignKey(model, params);
  if (!validation.ok) return validation;

  const mutated = cloneProjectModel(model);
  const table = mutated.tables.get(params.fromTableKey);
  if (!table) {
    return { ok: false, message: `Table not found: ${params.fromTableKey}` };
  }

  applyForeignKeyMutation(table, params);
  return buildFileEditCandidate(model, table, params.fromTableKey);
}

export function applyAddForeignKeyToModel(
  model: ProjectModel,
  params: AddForeignKeyParams,
): ProjectModel {
  const validation = validateAddForeignKey(model, params);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const mutated = cloneProjectModel(model);
  const table = mutated.tables.get(params.fromTableKey);
  if (!table) {
    throw new Error(`Table not found: ${params.fromTableKey}`);
  }

  applyForeignKeyMutation(table, params);
  return mutated;
}

function applyForeignKeyMutation(table: Table, params: AddForeignKeyParams): void {
  const [toSchema, toTable] = splitTableKey(params.toTableKey);
  const fk: ForeignKeyConstraint = {
    kind: "constraint",
    constraintType: "foreignKey",
    name: params.constraintName,
    columns: [params.fromColumn],
    references: {
      schema: toSchema,
      table: toTable,
      columns: [params.toColumn],
    },
  };
  table.members.push(fk);
}

function validateAddForeignKey(
  model: ProjectModel,
  params: AddForeignKeyParams,
): EditValidationResult | { ok: true } {
  if (params.fromTableKey === params.toTableKey) {
    return { ok: false, message: "Cannot create a foreign key from a table to itself." };
  }

  const fromResult = validateEditableTable(
    model.tables.get(params.fromTableKey),
    params.fromTableKey,
  );
  if (!fromResult.ok) return fromResult;

  const toTable = model.tables.get(params.toTableKey);
  if (!toTable) {
    return { ok: false, message: `Referenced table not found: ${params.toTableKey}` };
  }

  if (!findColumn(fromResult.table, params.fromColumn)) {
    return {
      ok: false,
      message: `Column ${params.fromColumn} not found on ${params.fromTableKey}.`,
    };
  }
  if (!findColumn(toTable, params.toColumn)) {
    return {
      ok: false,
      message: `Column ${params.toColumn} not found on ${params.toTableKey}.`,
    };
  }

  const constraintName = params.constraintName.trim();
  if (!constraintName) {
    return { ok: false, message: "Constraint name is required." };
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(constraintName)) {
    return {
      ok: false,
      message: "Constraint name must be a simple identifier (letters, digits, underscore).",
    };
  }

  if (constraintNameExists(fromResult.table, constraintName)) {
    return {
      ok: false,
      message: `Constraint ${constraintName} already exists on ${params.fromTableKey}.`,
    };
  }

  if (foreignKeyExists(fromResult.table, params.fromColumn, params.toTableKey, params.toColumn)) {
    return {
      ok: false,
      message: `A foreign key on ${params.fromColumn} → ${params.toTableKey}.${params.toColumn} already exists.`,
    };
  }

  return { ok: true };
}

function constraintNameExists(table: Table, name: string): boolean {
  return table.members.some(
    (m): m is Constraint => m.kind === "constraint" && m.name === name,
  );
}

function foreignKeyExists(
  table: Table,
  fromColumn: string,
  toTableKey: string,
  toColumn: string,
): boolean {
  const [toSchema, toTable] = splitTableKey(toTableKey);
  return table.members.some((m) => {
    if (m.kind !== "constraint" || m.constraintType !== "foreignKey") return false;
    return (
      m.columns.length === 1 &&
      m.columns[0] === fromColumn &&
      m.references.table === toTable &&
      (m.references.schema ?? "dbo") === toSchema &&
      m.references.columns.length === 1 &&
      m.references.columns[0] === toColumn
    );
  });
}

/** Exported for tests — inspect member list shape after an edit. */
export function listConstraintNames(table: Table): string[] {
  return table.members.flatMap((m: Member) => {
    switch (m.kind) {
      case "constraint":
        return [m.name];
      case "column":
      case "period":
        return [];
      default:
        return assertNever(m);
    }
  });
}
