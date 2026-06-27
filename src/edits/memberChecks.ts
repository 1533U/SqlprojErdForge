/**
 * Shared member/constraint checks for column edit ops (P3-2).
 */

import type { Column, ProjectModel, Table } from "../model.ts";

export function findColumn(table: Table, name: string): Column | undefined {
  return table.members.find((m): m is Column => m.kind === "column" && m.name === name);
}

export function validateEditableTable(
  table: Table | undefined,
  tableKey: string,
): { ok: true; table: Table } | { ok: false; message: string } {
  if (!table) {
    return { ok: false, message: `Table not found: ${tableKey}` };
  }
  if (table.readOnly) {
    return { ok: false, message: `${tableKey} is read-only and cannot be edited.` };
  }
  if (!table.roundTrippable) {
    return {
      ok: false,
      message: `${tableKey} has un-modeled content and cannot be rewritten safely.`,
    };
  }
  return { ok: true, table };
}

export function validateColumnName(name: string): { ok: true } | { ok: false; message: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, message: "Column name is required." };
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
    return {
      ok: false,
      message: "Column name must be a simple identifier (letters, digits, underscore).",
    };
  }
  return { ok: true };
}

/** Index before the first constraint or PERIOD member (C5 — columns precede constraints). */
export function insertIndexForNewColumn(table: Table): number {
  const idx = table.members.findIndex((m) => m.kind === "constraint" || m.kind === "period");
  return idx === -1 ? table.members.length : idx;
}

export function columnPkFkBlockReason(
  model: ProjectModel,
  tableKey: string,
  columnName: string,
): string | undefined {
  const table = model.tables.get(tableKey);
  if (!table) return `Table not found: ${tableKey}`;

  for (const member of table.members) {
    if (member.kind === "period") {
      if (member.startColumn === columnName || member.endColumn === columnName) {
        return `Column ${columnName} is used by PERIOD FOR SYSTEM_TIME and cannot be removed.`;
      }
      continue;
    }
    if (member.kind !== "constraint") continue;

    switch (member.constraintType) {
      case "primaryKey":
        if (member.columns.includes(columnName)) {
          return `Column ${columnName} is part of primary key ${member.name} and cannot be removed.`;
        }
        break;
      case "foreignKey":
        if (member.columns.includes(columnName)) {
          return `Column ${columnName} is part of foreign key ${member.name} and cannot be removed.`;
        }
        break;
      case "unique":
      case "check":
        break;
      default:
        break;
    }
  }

  const [schema, tableName] = splitTableKey(tableKey);
  for (const [fromKey, fromTable] of model.tables) {
    for (const member of fromTable.members) {
      if (member.kind !== "constraint" || member.constraintType !== "foreignKey") continue;
      const refSchema = member.references.schema ?? "dbo";
      if (refSchema !== schema || member.references.table !== tableName) continue;
      if (member.references.columns.includes(columnName)) {
        return `Column ${columnName} is referenced by ${fromKey}.${member.name} and cannot be removed.`;
      }
    }
  }

  return undefined;
}

export function splitTableKey(key: string): [string, string] {
  const dot = key.indexOf(".");
  if (dot === -1) return ["dbo", key];
  return [key.slice(0, dot), key.slice(dot + 1)];
}

export interface InboundFkReference {
  fromTableKey: string;
  constraintName: string;
}

export function findInboundFkReferences(
  model: ProjectModel,
  tableKey: string,
  columnName: string,
): InboundFkReference[] {
  const [schema, tableName] = splitTableKey(tableKey);
  const refs: InboundFkReference[] = [];

  for (const [fromKey, fromTable] of model.tables) {
    for (const member of fromTable.members) {
      if (member.kind !== "constraint" || member.constraintType !== "foreignKey") continue;
      const refSchema = member.references.schema ?? "dbo";
      if (refSchema !== schema || member.references.table !== tableName) continue;
      if (member.references.columns.includes(columnName)) {
        refs.push({ fromTableKey: fromKey, constraintName: member.name });
      }
    }
  }

  return refs;
}

export function replaceColumnNameInList(
  columns: string[],
  oldName: string,
  newName: string,
): boolean {
  let changed = false;
  for (let i = 0; i < columns.length; i++) {
    if (columns[i] === oldName) {
      columns[i] = newName;
      changed = true;
    }
  }
  return changed;
}
