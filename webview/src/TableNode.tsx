import { type NodeProps } from "@xyflow/react";
import { useState, type ReactElement } from "react";

import { ColumnRow } from "./ColumnRow";
import type { AddColumnIntent, GraphColumn } from "./types";

export interface TableNodeData extends Record<string, unknown> {
  tableKey: string;
  schema: string;
  name: string;
  readOnly: boolean;
  columns: GraphColumn[];
  showDescriptions: boolean;
  selected: boolean;
  selectedColumnName: string | undefined;
  onSelectTable: (tableKey: string) => void;
  onSelectColumn: (tableKey: string, columnName: string) => void;
  onRenameColumn: (tableKey: string, oldName: string, newName: string) => void;
  onChangeType: (tableKey: string, columnName: string, dataType: string) => void;
  onToggleNullable: (tableKey: string, columnName: string) => void;
  onEditComment: (tableKey: string, columnName: string, comment: string) => void;
  onRemoveColumn: (tableKey: string, columnName: string) => void;
  onAddColumn: (intent: AddColumnIntent) => void;
}

function removeBlockedReason(column: GraphColumn): string | undefined {
  if (column.isPrimaryKey) return "Primary-key columns can't be removed here.";
  if (column.isForeignKey) return "Foreign-key columns can't be removed here.";
  return undefined;
}

interface NewColumnForm {
  beforeColumnName: string | undefined;
  name: string;
  dataType: string;
  nullable: boolean;
}

export function TableNode({ data }: NodeProps): ReactElement {
  const d = data as TableNodeData;
  const editable = d.selected && !d.readOnly;
  const [adding, setAdding] = useState<NewColumnForm | null>(null);

  const beginAdd = (beforeColumnName: string | undefined): void => {
    setAdding({ beforeColumnName, name: "", dataType: "INT", nullable: true });
  };

  const commitAdd = (): void => {
    if (!adding) return;
    const name = adding.name.trim();
    const dataType = adding.dataType.trim();
    if (!name || !dataType) {
      setAdding(null);
      return;
    }
    d.onAddColumn({
      tableKey: d.tableKey,
      columnName: name,
      dataType,
      nullable: adding.nullable,
      ...(adding.beforeColumnName ? { beforeColumnName: adding.beforeColumnName } : {}),
    });
    setAdding(null);
  };

  return (
    <div
      className={[
        "table-node",
        d.readOnly ? "table-node--readonly" : "",
        d.selected ? "table-node--selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="table-node__header table-node__header--selectable"
        role="button"
        tabIndex={0}
        onClick={() => d.onSelectTable(d.tableKey)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            d.onSelectTable(d.tableKey);
          }
        }}
      >
        <span className="table-node__schema">{d.schema}</span>
        <span className="table-node__name">{d.name}</span>
        {d.readOnly ? <span className="table-node__badge">read-only</span> : null}
      </div>

      <div className="table-node__body">
        {d.columns.map((column) => (
          <ColumnRow
            key={column.name}
            column={column}
            editable={editable}
            readOnlyTable={d.readOnly}
            selected={d.selectedColumnName === column.name}
            showDescription={d.showDescriptions}
            removeBlockedReason={removeBlockedReason(column)}
            onSelect={() => d.onSelectColumn(d.tableKey, column.name)}
            onRename={(newName) => d.onRenameColumn(d.tableKey, column.name, newName)}
            onChangeType={(dataType) => d.onChangeType(d.tableKey, column.name, dataType)}
            onToggleNullable={() => d.onToggleNullable(d.tableKey, column.name)}
            onEditComment={(comment) => d.onEditComment(d.tableKey, column.name, comment)}
            onRemove={() => d.onRemoveColumn(d.tableKey, column.name)}
            onInsertBefore={() => beginAdd(column.name)}
          />
        ))}
      </div>

      {editable && adding ? (
        <div className="table-node__new-row nodrag">
          <input
            className="table-node__inline-input"
            placeholder="name"
            autoFocus
            value={adding.name}
            onChange={(e) => setAdding((cur) => (cur ? { ...cur, name: e.target.value } : cur))}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAdd();
              if (e.key === "Escape") setAdding(null);
            }}
          />
          <input
            className="table-node__inline-input table-node__inline-input--type"
            placeholder="type"
            value={adding.dataType}
            onChange={(e) => setAdding((cur) => (cur ? { ...cur, dataType: e.target.value } : cur))}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAdd();
              if (e.key === "Escape") setAdding(null);
            }}
          />
          <label className="table-node__new-row-null">
            <input
              type="checkbox"
              checked={adding.nullable}
              onChange={(e) =>
                setAdding((cur) => (cur ? { ...cur, nullable: e.target.checked } : cur))
              }
            />
            null
          </label>
          <button type="button" className="erdforge-btn" onClick={commitAdd}>
            Add
          </button>
          <button
            type="button"
            className="erdforge-btn erdforge-btn--ghost"
            onClick={() => setAdding(null)}
          >
            Cancel
          </button>
        </div>
      ) : editable ? (
        <button
          type="button"
          className="table-node__add-row nodrag"
          onClick={() => beginAdd(undefined)}
        >
          + Add column
        </button>
      ) : null}
    </div>
  );
}
