import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface GraphColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface TableNodeData extends Record<string, unknown> {
  schema: string;
  name: string;
  readOnly: boolean;
  columns: GraphColumn[];
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
        {nodeData.columns.map((column) => (
          <div className="table-node__row" key={column.name}>
            <span className="table-node__col-name">{column.name}</span>
            <span className="table-node__col-type">{column.dataType}</span>
            <span className="table-node__badges">
              {column.isPrimaryKey ? <span className="badge badge--pk">PK</span> : null}
              {column.isForeignKey ? <span className="badge badge--fk">FK</span> : null}
              {!column.nullable ? <span className="badge badge--nn">NN</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
