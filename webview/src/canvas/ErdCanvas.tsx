import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EditBanner } from "../edit/EditBanner";
import { TableNode, type TableNodeData } from "../TableNode";
import type { EditSessionState, GraphPayload } from "../types";
import { defaultEdgeOptions, payloadToFlow } from "./flowModel";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

const vscode = acquireVsCodeApi();

const nodeTypes = { table: TableNode };

function FitViewOnLoad({ tableCount, edgeCount }: { tableCount: number; edgeCount: number }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const timer = setTimeout(() => {
      void fitView({ padding: 0.2, duration: 200 });
    }, 50);
    return () => clearTimeout(timer);
  }, [fitView, tableCount, edgeCount]);

  return null;
}

export function ErdCanvas({
  payload,
  showDescriptions,
  edit,
  onNewColumnChange,
  onColumnSelect,
  onTableSelect,
  onConfirmFk,
  onConfirmAddColumn,
  onConfirmRemoveColumn,
  onConfirmRenameColumn,
  onConfirmChangeColumn,
  onConfirmAddTable,
  onConfirmDropTable,
  onConfirmRenameTable,
  onRenameNewNameChange,
  onChangeColumnDraftChange,
  onAddTableChange,
  onRenameTableChange,
  onCancelEdit,
}: {
  payload: GraphPayload;
  showDescriptions: boolean;
  edit: EditSessionState;
  onNewColumnChange: (patch: Partial<EditSessionState["newColumn"]>) => void;
  onColumnSelect: (tableKey: string, columnName: string) => void;
  onTableSelect: (tableKey: string) => void;
  onConfirmFk: () => void;
  onConfirmAddColumn: () => void;
  onConfirmRemoveColumn: () => void;
  onConfirmRenameColumn: () => void;
  onConfirmChangeColumn: () => void;
  onConfirmAddTable: () => void;
  onConfirmDropTable: () => void;
  onConfirmRenameTable: () => void;
  onRenameNewNameChange: (name: string) => void;
  onChangeColumnDraftChange: (patch: Partial<EditSessionState["changeColumnDraft"]>) => void;
  onAddTableChange: (patch: Partial<Pick<EditSessionState, "addTableSchema" | "addTableName">>) => void;
  onRenameTableChange: (patch: Partial<Pick<EditSessionState, "renameTableSchema" | "renameTableNewName">>) => void;
  onCancelEdit: () => void;
}) {
  const initial = useMemo(
    () => payloadToFlow(payload, showDescriptions, edit, onColumnSelect, onTableSelect),
    [payload, showDescriptions, edit, onColumnSelect, onTableSelect],
  );
  const [nodes, setNodes] = useState(initial.nodes);
  const [edges, setEdges] = useState(initial.edges);

  useEffect(() => {
    const next = payloadToFlow(payload, showDescriptions, edit, onColumnSelect, onTableSelect);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [payload, showDescriptions, edit, onColumnSelect, onTableSelect]);

  const onNodesChange = useCallback((changes: NodeChange<Node<TableNodeData>>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
    for (const change of changes) {
      if (change.type === "position" && change.position && change.dragging === false) {
        vscode.postMessage({
          type: "layoutUpdate",
          tableKey: change.id,
          x: change.position.x,
          y: change.position.y,
        });
      }
    }
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  return (
    <>
      <EditBanner
        edit={edit}
        onNewColumnChange={onNewColumnChange}
        onConfirmFk={onConfirmFk}
        onConfirmAddColumn={onConfirmAddColumn}
        onConfirmRemoveColumn={onConfirmRemoveColumn}
        onConfirmRenameColumn={onConfirmRenameColumn}
        onConfirmChangeColumn={onConfirmChangeColumn}
        onConfirmAddTable={onConfirmAddTable}
        onConfirmDropTable={onConfirmDropTable}
        onConfirmRenameTable={onConfirmRenameTable}
        onRenameNewNameChange={onRenameNewNameChange}
        onChangeColumnDraftChange={onChangeColumnDraftChange}
        onAddTableChange={onAddTableChange}
        onRenameTableChange={onRenameTableChange}
        onCancel={onCancelEdit}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <FitViewOnLoad tableCount={payload.tables.length} edgeCount={payload.edges.length} />
        <Background gap={16} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </>
  );
}
