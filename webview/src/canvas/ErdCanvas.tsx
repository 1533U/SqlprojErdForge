import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";

import { DraftToolbar } from "../DraftToolbar";
import { TableNode, type TableNodeData } from "../TableNode";
import type { DraftEntry } from "../session";
import { defaultEdgeOptions, payloadToFlow, type FlowViewInput } from "./flowModel";
import { vscode } from "../vscodeApi";

const nodeTypes = { table: TableNode };

function parseHandle(handle: string | null | undefined, prefix: string): string | undefined {
  if (!handle) return undefined;
  return handle.startsWith(`${prefix}::`) ? handle.slice(prefix.length + 2) : undefined;
}

function FitViewOnLoad({ tableCount, edgeCount }: { tableCount: number; edgeCount: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const timer = setTimeout(() => void fitView({ padding: 0.2, duration: 200 }), 50);
    return () => clearTimeout(timer);
  }, [fitView, tableCount, edgeCount]);
  return null;
}

export interface ErdCanvasProps {
  view: FlowViewInput;
  draft: DraftEntry[];
  message: string | undefined;
  onConnectColumns: (
    fromTableKey: string,
    fromColumn: string,
    toTableKey: string,
    toColumn: string | undefined,
  ) => void;
  onPaneClick: () => void;
  onReview: () => void;
  onDiscard: () => void;
  onRemoveEntry: (id: number) => void;
}

export function ErdCanvas(props: ErdCanvasProps): ReactElement {
  const { view } = props;
  const initial = useMemo(() => payloadToFlow(view), [view]);
  const [nodes, setNodes] = useState(initial.nodes);
  const [edges, setEdges] = useState(initial.edges);

  useEffect(() => {
    const next = payloadToFlow(view);
    // Preserve any in-session (un-persisted) drag positions across rebuilds.
    setNodes((current) => {
      const posById = new Map(current.map((n) => [n.id, n.position]));
      return next.nodes.map((n) => {
        const pos = posById.get(n.id);
        return pos ? { ...n, position: pos } : n;
      });
    });
    setEdges(next.edges);
  }, [view]);

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

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const fromColumn = parseHandle(connection.sourceHandle, "src");
      const toColumn = parseHandle(connection.targetHandle, "tgt");
      if (!fromColumn) return;
      props.onConnectColumns(connection.source, fromColumn, connection.target, toColumn);
    },
    [props],
  );

  return (
    <>
      <DraftToolbar
        draft={props.draft}
        message={props.message}
        onReview={props.onReview}
        onDiscard={props.onDiscard}
        onRemoveEntry={props.onRemoveEntry}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={props.onPaneClick}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <FitViewOnLoad
          tableCount={view.tables.length}
          edgeCount={view.edges.length + view.provisionalEdges.length}
        />
        <Background gap={16} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </>
  );
}
