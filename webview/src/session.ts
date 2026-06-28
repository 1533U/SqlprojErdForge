/**
 * Selection-first session state + pure draft logic for the direct-manipulation UX.
 *
 * The webview no longer has an explicit "edit mode": clicking a table selects and
 * highlights it, and edits (inline column changes, drag-to-link FKs) accumulate
 * into an ordered {@link DraftOp}[]. The draft is projected over the current graph
 * for instant optimistic feedback and committed in one go via "Review & apply"
 * (host `applyDraft` → `foldDraft` → combined diff preview).
 */

import type { DraftOp, GraphColumn, GraphTable } from "./types";
import { suggestForeignKeyName } from "./types";

function assertNever(value: never): never {
  throw new Error(`Unhandled draft op: ${JSON.stringify(value)}`);
}

export interface ColumnRef {
  tableKey: string;
  columnName: string;
}

export interface DraftEntry {
  /** Stable local id for list keys / removal. */
  id: number;
  op: DraftOp;
}

export interface SessionState {
  selectedTableKey: string | undefined;
  selectedColumn: ColumnRef | undefined;
  draft: DraftEntry[];
  nextDraftId: number;
  message: string | undefined;
}

export function initialSession(): SessionState {
  return {
    selectedTableKey: undefined,
    selectedColumn: undefined,
    draft: [],
    nextDraftId: 1,
    message: undefined,
  };
}

export function selectTable(session: SessionState, tableKey: string): SessionState {
  return { ...session, selectedTableKey: tableKey, selectedColumn: undefined, message: undefined };
}

export function selectColumn(
  session: SessionState,
  tableKey: string,
  columnName: string,
): SessionState {
  return {
    ...session,
    selectedTableKey: tableKey,
    selectedColumn: { tableKey, columnName },
    message: undefined,
  };
}

export function clearSelection(session: SessionState): SessionState {
  return { ...session, selectedTableKey: undefined, selectedColumn: undefined, message: undefined };
}

export function appendOp(session: SessionState, op: DraftOp): SessionState {
  return {
    ...session,
    draft: [...session.draft, { id: session.nextDraftId, op }],
    nextDraftId: session.nextDraftId + 1,
    message: undefined,
  };
}

export function removeDraftEntry(session: SessionState, id: number): SessionState {
  return { ...session, draft: session.draft.filter((e) => e.id !== id) };
}

export function clearDraft(session: SessionState): SessionState {
  return { ...session, draft: [], message: undefined };
}

export function withMessage(session: SessionState, message: string | undefined): SessionState {
  return { ...session, message };
}

export function draftOps(session: SessionState): DraftOp[] {
  return session.draft.map((e) => e.op);
}

function shortKey(tableKey: string): string {
  const dot = tableKey.indexOf(".");
  return dot === -1 ? tableKey : tableKey.slice(dot + 1);
}

/** One-line human summary of a draft op for the toolbar. */
export function describeOp(op: DraftOp): string {
  switch (op.type) {
    case "addColumn":
      return `Add ${shortKey(op.intent.tableKey)}.${op.intent.columnName} ${op.intent.dataType}`;
    case "removeColumn":
      return `Remove ${shortKey(op.intent.tableKey)}.${op.intent.columnName}`;
    case "renameColumn":
      return `Rename ${shortKey(op.intent.tableKey)}.${op.intent.oldName} → ${op.intent.newName}`;
    case "changeColumn":
      return `Set ${shortKey(op.intent.tableKey)}.${op.intent.columnName} ${op.intent.dataType} ${
        op.intent.nullable ? "NULL" : "NOT NULL"
      }`;
    case "editComment":
      return `Comment ${shortKey(op.intent.tableKey)}.${op.intent.columnName}`;
    case "addForeignKey":
      return `Link ${shortKey(op.intent.fromTableKey)}.${op.intent.fromColumn} → ${shortKey(
        op.intent.toTableKey,
      )}.${op.intent.toColumn}`;
    default:
      return assertNever(op);
  }
}

export interface ProvisionalEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  fromColumn: string;
  toColumn: string;
}

/**
 * Project a draft over the current tables for optimistic rendering. Returns new
 * table objects (originals untouched) plus provisional FK edges to draw dashed.
 */
export function projectDraft(
  tables: GraphTable[],
  ops: DraftOp[],
): { tables: GraphTable[]; provisionalEdges: ProvisionalEdge[] } {
  const byKey = new Map<string, GraphTable>(
    tables.map((t) => [t.key, { ...t, columns: t.columns.map((c) => ({ ...c })) }]),
  );
  const provisionalEdges: ProvisionalEdge[] = [];

  ops.forEach((op, index) => {
    switch (op.type) {
      case "addColumn": {
        const table = byKey.get(op.intent.tableKey);
        if (!table) break;
        const column: GraphColumn = {
          name: op.intent.columnName,
          dataType: op.intent.dataType,
          nullable: op.intent.nullable,
          isPrimaryKey: false,
          isForeignKey: false,
          ...(op.intent.trailingComment ? { description: op.intent.trailingComment } : {}),
        };
        const at = op.intent.beforeColumnName
          ? table.columns.findIndex((c) => c.name === op.intent.beforeColumnName)
          : -1;
        if (at >= 0) table.columns.splice(at, 0, column);
        else table.columns.push(column);
        break;
      }
      case "removeColumn": {
        const table = byKey.get(op.intent.tableKey);
        if (table) table.columns = table.columns.filter((c) => c.name !== op.intent.columnName);
        break;
      }
      case "renameColumn": {
        const column = byKey
          .get(op.intent.tableKey)
          ?.columns.find((c) => c.name === op.intent.oldName);
        if (column) column.name = op.intent.newName;
        break;
      }
      case "changeColumn": {
        const column = byKey
          .get(op.intent.tableKey)
          ?.columns.find((c) => c.name === op.intent.columnName);
        if (column) {
          column.dataType = op.intent.dataType;
          column.nullable = op.intent.nullable;
        }
        break;
      }
      case "editComment": {
        const column = byKey
          .get(op.intent.tableKey)
          ?.columns.find((c) => c.name === op.intent.columnName);
        if (column) column.description = op.intent.comment || undefined;
        break;
      }
      case "addForeignKey": {
        const column = byKey
          .get(op.intent.fromTableKey)
          ?.columns.find((c) => c.name === op.intent.fromColumn);
        if (column) column.isForeignKey = true;
        provisionalEdges.push({
          id: `draft::fk::${index}`,
          from: op.intent.fromTableKey,
          to: op.intent.toTableKey,
          label: op.intent.constraintName,
          fromColumn: op.intent.fromColumn,
          toColumn: op.intent.toColumn,
        });
        break;
      }
      default:
        assertNever(op);
    }
  });

  return { tables: [...byKey.values()], provisionalEdges };
}

/**
 * Whether a draft op's effect is NOT yet present in the given tables — i.e. it
 * still needs applying. Used to self-heal the draft when a fresh graph arrives
 * (e.g. after the user applied the preview) without discarding still-pending
 * edits on unrelated refreshes.
 */
export function isOpPending(tables: GraphTable[], op: DraftOp): boolean {
  const byKey = new Map(tables.map((t) => [t.key, t]));
  const col = (key: string, name: string): GraphColumn | undefined =>
    byKey.get(key)?.columns.find((c) => c.name === name);
  const sameType = (a: string, b: string): boolean =>
    a.trim().toLowerCase() === b.trim().toLowerCase();

  switch (op.type) {
    case "addColumn":
      return byKey.has(op.intent.tableKey) && !col(op.intent.tableKey, op.intent.columnName);
    case "removeColumn":
      return byKey.has(op.intent.tableKey) && !!col(op.intent.tableKey, op.intent.columnName);
    case "renameColumn":
      return (
        !!col(op.intent.tableKey, op.intent.oldName) && !col(op.intent.tableKey, op.intent.newName)
      );
    case "changeColumn": {
      const c = col(op.intent.tableKey, op.intent.columnName);
      return !!c && (!sameType(c.dataType, op.intent.dataType) || c.nullable !== op.intent.nullable);
    }
    case "editComment": {
      const c = col(op.intent.tableKey, op.intent.columnName);
      return !!c && (c.description ?? "") !== op.intent.comment;
    }
    case "addForeignKey": {
      const c = col(op.intent.fromTableKey, op.intent.fromColumn);
      return !!c && !c.isForeignKey;
    }
    default:
      return assertNever(op);
  }
}

/** Keep only draft entries whose effect is still pending against the given tables. */
export function pruneAppliedEntries(tables: GraphTable[], draft: DraftEntry[]): DraftEntry[] {
  return draft.filter((entry) => isOpPending(tables, entry.op));
}

/**
 * Resolve a drag-to-link connection into an `addForeignKey` op. When the target
 * column is unspecified (dropped on the table), auto-resolves a sole PK, else
 * asks the user to drop on a specific PK column.
 */
export function resolveFkOp(
  tables: GraphTable[],
  fromTableKey: string,
  fromColumn: string,
  toTableKey: string,
  toColumn: string | undefined,
): { ok: true; op: DraftOp } | { ok: false; message: string } {
  if (fromTableKey === toTableKey) {
    return { ok: false, message: "Cannot link a table to itself." };
  }
  const fromTable = tables.find((t) => t.key === fromTableKey);
  if (fromTable?.readOnly) {
    return { ok: false, message: `${shortKey(fromTableKey)} is read-only and cannot be edited.` };
  }
  const toTable = tables.find((t) => t.key === toTableKey);
  if (!toTable) {
    return { ok: false, message: `Unknown table ${toTableKey}.` };
  }

  let target = toColumn;
  if (!target) {
    const pks = toTable.columns.filter((c) => c.isPrimaryKey);
    if (pks.length === 1) {
      target = pks[0]!.name;
    } else {
      return {
        ok: false,
        message: `Drop the link onto a primary-key column of ${shortKey(toTableKey)}.`,
      };
    }
  } else {
    const targetColumn = toTable.columns.find((c) => c.name === target);
    if (!targetColumn) {
      return { ok: false, message: `Column ${target} not found on ${shortKey(toTableKey)}.` };
    }
    if (!targetColumn.isPrimaryKey) {
      return {
        ok: false,
        message: `A foreign key must reference a primary-key column; ${target} is not a PK.`,
      };
    }
  }

  return {
    ok: true,
    op: {
      type: "addForeignKey",
      intent: {
        fromTableKey,
        fromColumn,
        toTableKey,
        toColumn: target,
        constraintName: suggestForeignKeyName(fromTableKey, toTableKey),
      },
    },
  };
}
