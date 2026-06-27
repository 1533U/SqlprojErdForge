import { Handle, Position, type NodeProps } from "@xyflow/react";

import { computeColumnRowEditState } from "./columnEditState";
import type { ColumnRef, EditMode, GraphColumn } from "./types";

export interface TableNodeData extends Record<string, unknown> {
  tableKey: string;
  schema: string;
  name: string;
  readOnly: boolean;
  columns: GraphColumn[];
  showDescriptions: boolean;
  editMode: EditMode;
  fkSource: ColumnRef | undefined;
  addColumnTableKey: string | undefined;
  removeColumnTarget: ColumnRef | undefined;
  renameColumnTarget: ColumnRef | undefined;
  onColumnSelect: (tableKey: string, columnName: string) => void;
  onTableSelect: (tableKey: string) => void;
}

function rowClassNames(state: ReturnType<typeof computeColumnRowEditState>, editMode: EditMode): string {
  return [
    "table-node__row",
    state.isSelectable ? "table-node__row--selectable" : "",
    state.isRemoveBlocked && editMode === "removeColumn" ? "table-node__row--blocked" : "",
    state.isFkSource ? "table-node__row--fk-source" : "",
    state.isFkTarget ? "table-node__row--fk-target" : "",
    state.isRemoveTarget ? "table-node__row--remove-target" : "",
    state.isRenameTarget ? "table-node__row--rename-target" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function TableNode({ data }: NodeProps) {
  const nodeData = data as TableNodeData;
  const isAddColumnTarget =
    nodeData.editMode === "addColumn" &&
    nodeData.addColumnTableKey === nodeData.tableKey;
  const headerSelectable =
    nodeData.editMode === "addColumn" && !nodeData.readOnly;

  return (
    <div className={`table-node${nodeData.readOnly ? " table-node--readonly" : ""}`}>
      <Handle className="table-node__handle table-node__handle--target" type="target" position={Position.Left} />
      <Handle className="table-node__handle table-node__handle--source" type="source" position={Position.Right} />
      <div
        className={[
          "table-node__header",
          headerSelectable ? "table-node__header--selectable" : "",
          isAddColumnTarget ? "table-node__header--selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={
          headerSelectable
            ? () => nodeData.onTableSelect(nodeData.tableKey)
            : undefined
        }
        onKeyDown={
          headerSelectable
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  nodeData.onTableSelect(nodeData.tableKey);
                }
              }
            : undefined
        }
        role={headerSelectable ? "button" : undefined}
        tabIndex={headerSelectable ? 0 : undefined}
      >
        <span className="table-node__schema">{nodeData.schema}</span>
        <span className="table-node__name">{nodeData.name}</span>
        {nodeData.readOnly ? <span className="table-node__badge">read-only</span> : null}
      </div>
      <div className="table-node__body">
        {nodeData.columns.map((column) => {
          const state = computeColumnRowEditState(
            nodeData.editMode,
            nodeData.readOnly,
            nodeData.fkSource,
            nodeData.removeColumnTarget,
            nodeData.renameColumnTarget,
            nodeData.tableKey,
            column,
          );

          return (
            <div className="table-node__column" key={column.name}>
              <div
                className={rowClassNames(state, nodeData.editMode)}
                onClick={
                  state.isSelectable
                    ? () => nodeData.onColumnSelect(nodeData.tableKey, column.name)
                    : undefined
                }
                onKeyDown={
                  state.isSelectable
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          nodeData.onColumnSelect(nodeData.tableKey, column.name);
                        }
                      }
                    : undefined
                }
                role={state.isSelectable ? "button" : undefined}
                tabIndex={state.isSelectable ? 0 : undefined}
                title={
                  state.isRemoveBlocked && nodeData.editMode === "removeColumn"
                    ? "Cannot remove a PK or FK column"
                    : undefined
                }
              >
                <span className="table-node__col-name">{column.name}</span>
                <span className="table-node__col-type">{column.dataType}</span>
                <span className="table-node__badges">
                  {column.isPrimaryKey ? <span className="badge badge--pk">PK</span> : null}
                  {column.isForeignKey ? <span className="badge badge--fk">FK</span> : null}
                  {!column.nullable ? <span className="badge badge--nn">NN</span> : null}
                </span>
              </div>
              {nodeData.showDescriptions && column.description ? (
                <div className="table-node__description" title={column.description}>
                  {column.description}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
