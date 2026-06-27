/**
 * Add a declared FOREIGN KEY constraint to one table (P3-1).
 */

import type {
  Column,
  Constraint,
  ForeignKeyConstraint,
  Member,
  ProjectModel,
  Table,
} from "../model.ts";
import { assertNever } from "../model.ts";
import { cloneProjectModel } from "./cloneModel.ts";
import { emitTable } from "../emitter.ts";
import { contentRevision, readTableSource, tableAbsPath } from "./paths.ts";
import type { AddForeignKeyParams, EditValidationResult } from "./types.ts";

export function suggestForeignKeyName(fromTableKey: string, toTableKey: string): string {
  const from = tableShortName(fromTableKey);
  const to = tableShortName(toTableKey);
  return `FK_${from}_${to}`;
}

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

  let originalContent: string;
  try {
    originalContent = readTableSource(model.projectPath, table);
  } catch {
    return { ok: false, message: `Source file not found for ${params.fromTableKey}` };
  }

  return {
    ok: true,
    candidate: {
      absPath: tableAbsPath(model.projectPath, table),
      sourceFile: table.sourceFile,
      originalContent,
      candidateContent: emitTable(table),
      originalRevision: contentRevision(originalContent),
    },
  };
}

export function applyAddForeignKeyToModel(
  model: ProjectModel,
  params: AddForeignKeyParams,
): ProjectModel {
  const result = prepareAddForeignKey(model, params);
  if (!result.ok) {
    throw new Error(result.message);
  }

  const mutated = cloneProjectModel(model);
  const table = mutated.tables.get(params.fromTableKey);
  if (!table) {
    throw new Error(`Table not found: ${params.fromTableKey}`);
  }

  const [toSchema, toTable] = splitTableKey(params.toTableKey);
  table.members.push({
    kind: "constraint",
    constraintType: "foreignKey",
    name: params.constraintName,
    columns: [params.fromColumn],
    references: {
      schema: toSchema,
      table: toTable,
      columns: [params.toColumn],
    },
  });
  return mutated;
}

function validateAddForeignKey(
  model: ProjectModel,
  params: AddForeignKeyParams,
): EditValidationResult | { ok: true } {
  if (params.fromTableKey === params.toTableKey) {
    return { ok: false, message: "Cannot create a foreign key from a table to itself." };
  }

  const fromTable = model.tables.get(params.fromTableKey);
  if (!fromTable) {
    return { ok: false, message: `Source table not found: ${params.fromTableKey}` };
  }
  const toTable = model.tables.get(params.toTableKey);
  if (!toTable) {
    return { ok: false, message: `Referenced table not found: ${params.toTableKey}` };
  }

  if (fromTable.readOnly) {
    return { ok: false, message: `${params.fromTableKey} is read-only and cannot be edited.` };
  }
  if (!fromTable.roundTrippable) {
    return {
      ok: false,
      message: `${params.fromTableKey} has un-modeled content and cannot be rewritten safely.`,
    };
  }

  if (!findColumn(fromTable, params.fromColumn)) {
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

  if (constraintNameExists(fromTable, constraintName)) {
    return {
      ok: false,
      message: `Constraint ${constraintName} already exists on ${params.fromTableKey}.`,
    };
  }

  if (foreignKeyExists(fromTable, params.fromColumn, params.toTableKey, params.toColumn)) {
    return {
      ok: false,
      message: `A foreign key on ${params.fromColumn} → ${params.toTableKey}.${params.toColumn} already exists.`,
    };
  }

  return { ok: true };
}

function findColumn(table: Table, name: string): Column | undefined {
  return table.members.find((m): m is Column => m.kind === "column" && m.name === name);
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

function splitTableKey(key: string): [string, string] {
  const dot = key.indexOf(".");
  if (dot === -1) return ["dbo", key];
  return [key.slice(0, dot), key.slice(dot + 1)];
}

function tableShortName(tableKey: string): string {
  const dot = tableKey.indexOf(".");
  return dot === -1 ? tableKey : tableKey.slice(dot + 1);
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
