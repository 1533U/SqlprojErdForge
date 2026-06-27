import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { ColumnRef, GraphColumn } from "./types";

export interface TableNodeData extends Record<string, unknown> {
  tableKey: string;
  schema: string;
  name: string;
  readOnly: boolean;
  columns: GraphColumn[];
  showDescriptions: boolean;
  fkMode: boolean;
  fkSource: ColumnRef | undefined;
  onColumnSelect: (tableKey: string, columnName: string) => void;
}

export function TableNode({ data }: NodeProps) {
  const nodeData = data as TableNodeData;
  return (
    <div className={`table-node${nodeData.readOnly ? " table-node--readonly" : ""}`}>
      <Handle className="table-node__handle table-node__handle--target" type="target" position={Position.Left} />
      <Handle className="table-node__handle table-node__handle--source" type="source" position={Position.Right} />
      <div className="table-node__header">
        <span className="table-node__schema">{nodeData.schema}</span>
        <span className="table-node__name">{nodeData.name}</span>
        {nodeData.readOnly ? <span className="table-node__badge">read-only</span> : null}
      </div>
      <div className="table-node__body">
        {nodeData.columns.map((column) => {
          const isSource =
            nodeData.fkSource?.tableKey === nodeData.tableKey &&
            nodeData.fkSource.columnName === column.name;
          const isFkTarget =
            nodeData.fkMode &&
            nodeData.fkSource != null &&
            !isSource &&
            column.isPrimaryKey;
          const isSelectable =
            nodeData.fkMode &&
            (!nodeData.readOnly || nodeData.fkSource != null) &&
            (nodeData.fkSource == null ? !nodeData.readOnly : isFkTarget || isSource);

          return (
            <div className="table-node__column" key={column.name}>
              <div
                className={[
                  "table-node__row",
                  isSelectable ? "table-node__row--selectable" : "",
                  isSource ? "table-node__row--fk-source" : "",
                  isFkTarget ? "table-node__row--fk-target" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={
                  isSelectable
                    ? () => nodeData.onColumnSelect(nodeData.tableKey, column.name)
                    : undefined
                }
                onKeyDown={
                  isSelectable
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          nodeData.onColumnSelect(nodeData.tableKey, column.name);
                        }
                      }
                    : undefined
                }
                role={isSelectable ? "button" : undefined}
                tabIndex={isSelectable ? 0 : undefined}
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
