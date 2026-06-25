import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TableNode, type TableNodeData } from "./TableNode";
import type { GraphPayload, HostToWebviewMessage, WebviewToHostMessage } from "./types";

declare function acquireVsCodeApi(): {
  postMessage(message: WebviewToHostMessage): void;
};

const vscode = acquireVsCodeApi();

const nodeTypes = { table: TableNode };

const defaultEdgeOptions = {
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

function payloadToFlow(payload: GraphPayload): { nodes: Node<TableNodeData>[]; edges: Edge[] } {
  const nodes: Node<TableNodeData>[] = payload.tables.map((table) => {
    const pos = payload.layout.tables[table.key];
    return {
      id: table.key,
      type: "table",
      position: { x: pos?.x ?? 0, y: pos?.y ?? 0 },
      data: {
        schema: table.schema,
        name: table.name,
        readOnly: table.readOnly,
        columns: table.columns,
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

function ErdCanvas({ payload }: { payload: GraphPayload }) {
  const initial = useMemo(() => payloadToFlow(payload), [payload]);
  const [nodes, setNodes] = useState(initial.nodes);
  const [edges, setEdges] = useState(initial.edges);

  useEffect(() => {
    const next = payloadToFlow(payload);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [payload]);

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
  );
}

export function App() {
  const [payload, setPayload] = useState<GraphPayload | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostToWebviewMessage>): void => {
      const message = event.data;
      switch (message.type) {
        case "graph":
          setError(undefined);
          setPayload(message.payload);
          break;
        case "error":
          setError(message.message);
          break;
        default:
          break;
      }
    };

    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (error) {
    return (
      <div className="erdforge-shell erdforge-error">
        <h1>ErdForge</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="erdforge-shell erdforge-loading">
        <p>Loading ERD…</p>
      </div>
    );
  }

  return (
    <div className="erdforge-shell">
      <header className="erdforge-header">
        <h1>{payload.projectName}</h1>
        <span>
          {payload.tables.length} tables · {payload.edges.length} FK edges
        </span>
      </header>
      <div className="erdforge-canvas">
        <ReactFlowProvider>
          <ErdCanvas payload={payload} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
