import type { Edge, Node } from "@xyflow/react";

import type { ProvisionalEdge } from "../session";
import type { TableNodeData } from "../TableNode";
import type { AddColumnIntent, GraphEdge, GraphTable, LayoutFile } from "../types";

export const defaultEdgeOptions = {
  type: "smoothstep" as const,
  style: {
    stroke: "var(--vscode-focusBorder, #3794ff)",
    strokeWidth: 2,
  },
  labelStyle: {
    fill: "var(--vscode-editor-foreground, #cccccc)",
    fontSize: 10,
  },
  labelBgStyle: {
    fill: "var(--vscode-editor-background, #1e1e1e)",
    fillOpacity: 0.85,
  },
};

const provisionalEdgeStyle = {
  stroke: "var(--vscode-charts-green, #89d185)",
  strokeWidth: 2,
  strokeDasharray: "6 4",
};

export interface FlowCallbacks {
  onSelectTable: (tableKey: string) => void;
  onSelectColumn: (tableKey: string, columnName: string) => void;
  onRenameColumn: (tableKey: string, oldName: string, newName: string) => void;
  onChangeType: (tableKey: string, columnName: string, dataType: string) => void;
  onToggleNullable: (tableKey: string, columnName: string) => void;
  onEditComment: (tableKey: string, columnName: string, comment: string) => void;
  onRemoveColumn: (tableKey: string, columnName: string) => void;
  onAddColumn: (intent: AddColumnIntent) => void;
}

export interface FlowViewInput {
  tables: GraphTable[];
  edges: GraphEdge[];
  provisionalEdges: ProvisionalEdge[];
  layout: LayoutFile;
  showDescriptions: boolean;
  selectedTableKey: string | undefined;
  selectedColumn: { tableKey: string; columnName: string } | undefined;
  callbacks: FlowCallbacks;
}

export function payloadToFlow(input: FlowViewInput): {
  nodes: Node<TableNodeData>[];
  edges: Edge[];
} {
  const { callbacks } = input;
  const nodes: Node<TableNodeData>[] = input.tables.map((table) => {
    const pos = input.layout.tables[table.key];
    return {
      id: table.key,
      type: "table",
      position: { x: pos?.x ?? 0, y: pos?.y ?? 0 },
      data: {
        tableKey: table.key,
        schema: table.schema,
        name: table.name,
        readOnly: table.readOnly,
        columns: table.columns,
        showDescriptions: input.showDescriptions,
        selected: table.key === input.selectedTableKey,
        selectedColumnName:
          input.selectedColumn?.tableKey === table.key
            ? input.selectedColumn.columnName
            : undefined,
        onSelectTable: callbacks.onSelectTable,
        onSelectColumn: callbacks.onSelectColumn,
        onRenameColumn: callbacks.onRenameColumn,
        onChangeType: callbacks.onChangeType,
        onToggleNullable: callbacks.onToggleNullable,
        onEditComment: callbacks.onEditComment,
        onRemoveColumn: callbacks.onRemoveColumn,
        onAddColumn: callbacks.onAddColumn,
      },
    };
  });

  const edges: Edge[] = input.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edge.label,
    ...(edge.fromColumn ? { sourceHandle: `src::${edge.fromColumn}` } : {}),
    ...(edge.toColumn ? { targetHandle: `tgt::${edge.toColumn}` } : {}),
    ...defaultEdgeOptions,
  }));

  const provisional: Edge[] = input.provisionalEdges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edge.label,
    sourceHandle: `src::${edge.fromColumn}`,
    targetHandle: `tgt::${edge.toColumn}`,
    type: "smoothstep",
    animated: true,
    style: provisionalEdgeStyle,
    labelStyle: defaultEdgeOptions.labelStyle,
    labelBgStyle: defaultEdgeOptions.labelBgStyle,
  }));

  return { nodes, edges: [...edges, ...provisional] };
}
