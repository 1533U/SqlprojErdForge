import type { Edge, Node } from "@xyflow/react";

import type { EditSessionState } from "../types";
import type { GraphPayload } from "../types";
import type { TableNodeData } from "../TableNode";

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

export function payloadToFlow(
  payload: GraphPayload,
  showDescriptions: boolean,
  edit: EditSessionState,
  onColumnSelect: (tableKey: string, columnName: string) => void,
  onTableSelect: (tableKey: string) => void,
): { nodes: Node<TableNodeData>[]; edges: Edge[] } {
  const nodes: Node<TableNodeData>[] = payload.tables.map((table) => {
    const pos = payload.layout.tables[table.key];
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
        showDescriptions,
        editMode: edit.mode,
        fkSource: edit.fkSource,
        addColumnTableKey: edit.addColumnTableKey,
        removeColumnTarget: edit.removeColumnTarget,
        renameColumnTarget: edit.renameColumnTarget,
        changeColumnTarget: edit.changeColumnTarget,
        onColumnSelect,
        onTableSelect,
      },
    };
  });

  const edges: Edge[] = payload.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edge.label,
    ...defaultEdgeOptions,
  }));

  return { nodes, edges };
}
