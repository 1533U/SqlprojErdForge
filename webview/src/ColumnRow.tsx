import { Handle, Position } from "@xyflow/react";
import { useEffect, useRef, useState, type ReactElement } from "react";

import type { GraphColumn } from "./types";

type InlineField = "name" | "type" | "comment";

export interface ColumnRowProps {
  column: GraphColumn;
  editable: boolean;
  selected: boolean;
  readOnlyTable: boolean;
  showDescription: boolean;
  removeBlockedReason: string | undefined;
  onSelect: () => void;
  onRename: (newName: string) => void;
  onChangeType: (dataType: string) => void;
  onToggleNullable: () => void;
  onEditComment: (comment: string) => void;
  onRemove: () => void;
  onInsertBefore: () => void;
}

export function ColumnRow(props: ColumnRowProps): ReactElement {
  const { column, editable } = props;
  const [editing, setEditing] = useState<{ field: InlineField; value: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const begin = (field: InlineField, value: string): void => {
    if (!editable) {
      props.onSelect();
      return;
    }
    setEditing({ field, value });
  };

  const commit = (): void => {
    if (!editing) return;
    const value = editing.value.trim();
    const field = editing.field;
    setEditing(null);
    if (field === "name") {
      if (value && value !== column.name) props.onRename(value);
    } else if (field === "type") {
      if (value && value !== column.dataType) props.onChangeType(value);
    } else {
      if (value !== (column.description ?? "")) props.onEditComment(value);
    }
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditing(null);
    }
  };

  const renderEditingInput = (): ReactElement => (
    <input
      ref={inputRef}
      className={`table-node__inline-input nodrag${
        editing?.field === "type" ? " table-node__inline-input--type" : ""
      }`}
      value={editing?.value ?? ""}
      onChange={(e) => setEditing((cur) => (cur ? { ...cur, value: e.target.value } : cur))}
      onKeyDown={onInputKeyDown}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
    />
  );

  const rowClass = [
    "table-node__row",
    editable ? "table-node__row--editable" : "table-node__row--selectable",
    props.selected ? "table-node__row--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="table-node__column">
      {editable ? (
        <button
          type="button"
          className="table-node__insert nodrag"
          title="Add a column before this one"
          onClick={(e) => {
            e.stopPropagation();
            props.onInsertBefore();
          }}
        >
          +
        </button>
      ) : null}

      <div
        className={rowClass}
        onClick={() => props.onSelect()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            props.onSelect();
          }
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          id={`tgt::${column.name}`}
          isConnectable={column.isPrimaryKey}
          className={`table-node__col-handle table-node__col-handle--target${
            column.isPrimaryKey ? " table-node__col-handle--pk" : ""
          }`}
        />

        {editing?.field === "name" ? (
          renderEditingInput()
        ) : (
          <span
            className="table-node__col-name"
            onClick={(e) => {
              e.stopPropagation();
              begin("name", column.name);
            }}
            title={editable ? "Click to rename" : column.name}
          >
            {column.name}
          </span>
        )}

        {editing?.field === "type" ? (
          renderEditingInput()
        ) : (
          <span
            className="table-node__col-type"
            onClick={(e) => {
              e.stopPropagation();
              begin("type", column.dataType);
            }}
            title={editable ? "Click to change type" : column.dataType}
          >
            {column.dataType}
          </span>
        )}

        <span className="table-node__badges">
          {column.isPrimaryKey ? <span className="badge badge--pk">PK</span> : null}
          {column.isForeignKey ? <span className="badge badge--fk">FK</span> : null}
          {editable ? (
            <button
              type="button"
              className={`badge badge--nn table-node__nn-toggle nodrag${
                column.nullable ? " table-node__nn-toggle--null" : ""
              }`}
              title={column.nullable ? "Nullable — click for NOT NULL" : "NOT NULL — click for NULL"}
              onClick={(e) => {
                e.stopPropagation();
                props.onToggleNullable();
              }}
            >
              {column.nullable ? "NULL" : "NN"}
            </button>
          ) : !column.nullable ? (
            <span className="badge badge--nn">NN</span>
          ) : null}
          {editable ? (
            <button
              type="button"
              className="table-node__remove nodrag"
              disabled={props.removeBlockedReason !== undefined}
              title={props.removeBlockedReason ?? "Remove column"}
              onClick={(e) => {
                e.stopPropagation();
                if (props.removeBlockedReason === undefined) props.onRemove();
              }}
            >
              ×
            </button>
          ) : null}
        </span>

        <Handle
          type="source"
          position={Position.Right}
          id={`src::${column.name}`}
          isConnectable={!props.readOnlyTable}
          className="table-node__col-handle table-node__col-handle--source"
        />
      </div>

      {editing?.field === "comment" ? (
        <div className="table-node__description">{renderEditingInput()}</div>
      ) : props.showDescription && column.description ? (
        <div
          className="table-node__description"
          title={editable ? "Click to edit comment" : column.description}
          onClick={(e) => {
            e.stopPropagation();
            begin("comment", column.description ?? "");
          }}
        >
          {column.description}
        </div>
      ) : editable && props.showDescription ? (
        <button
          type="button"
          className="table-node__add-comment nodrag"
          onClick={(e) => {
            e.stopPropagation();
            begin("comment", "");
          }}
        >
          + comment
        </button>
      ) : null}
    </div>
  );
}
