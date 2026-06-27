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
import type {
  ColumnRef,
  GraphPayload,
  HostToWebviewMessage,
  WebviewToHostMessage,
} from "./types";
import { suggestForeignKeyName } from "./types";

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

function payloadToFlow(
  payload: GraphPayload,
  showDescriptions: boolean,
  fkMode: boolean,
  fkSource: ColumnRef | undefined,
  onColumnSelect: (tableKey: string, columnName: string) => void,
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
        fkMode,
        fkSource,
        onColumnSelect,
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

function ErdCanvas({
  payload,
  showDescriptions,
  fkMode,
  fkSource,
  fkTarget,
  editMessage,
  onColumnSelect,
  onCancelFk,
  onConfirmFk,
}: {
  payload: GraphPayload;
  showDescriptions: boolean;
  fkMode: boolean;
  fkSource: ColumnRef | undefined;
  fkTarget: ColumnRef | undefined;
  editMessage: string | undefined;
  onColumnSelect: (tableKey: string, columnName: string) => void;
  onCancelFk: () => void;
  onConfirmFk: () => void;
}) {
  const initial = useMemo(
    () => payloadToFlow(payload, showDescriptions, fkMode, fkSource, onColumnSelect),
    [payload, showDescriptions, fkMode, fkSource, onColumnSelect],
  );
  const [nodes, setNodes] = useState(initial.nodes);
  const [edges, setEdges] = useState(initial.edges);

  useEffect(() => {
    const next = payloadToFlow(payload, showDescriptions, fkMode, fkSource, onColumnSelect);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [payload, showDescriptions, fkMode, fkSource, onColumnSelect]);

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

  const constraintName =
    fkSource && fkTarget
      ? suggestForeignKeyName(fkSource.tableKey, fkTarget.tableKey)
      : undefined;

  return (
    <>
      {fkMode ? (
        <div className="erdforge-fk-banner">
          {fkSource == null ? (
            <span>Click a column on the table that will hold the foreign key.</span>
          ) : fkTarget == null ? (
            <span>
              Source: <strong>{fkSource.tableKey}.{fkSource.columnName}</strong> — now click a
              primary-key column on the referenced table.
            </span>
          ) : (
            <span>
              {fkSource.tableKey}.{fkSource.columnName} → {fkTarget.tableKey}.{fkTarget.columnName}
              {constraintName ? ` (${constraintName})` : null}
            </span>
          )}
          {editMessage ? <span className="erdforge-fk-banner__error">{editMessage}</span> : null}
          <span className="erdforge-fk-banner__actions">
            {fkSource && fkTarget ? (
              <button type="button" className="erdforge-btn" onClick={onConfirmFk}>
                Preview FK
              </button>
            ) : null}
            <button type="button" className="erdforge-btn erdforge-btn--ghost" onClick={onCancelFk}>
              Cancel
            </button>
          </span>
        </div>
      ) : null}
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

export function App() {
  const [payload, setPayload] = useState<GraphPayload | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [fkMode, setFkMode] = useState(false);
  const [fkSource, setFkSource] = useState<ColumnRef | undefined>();
  const [fkTarget, setFkTarget] = useState<ColumnRef | undefined>();
  const [editMessage, setEditMessage] = useState<string | undefined>();

  const resetFkSelection = useCallback(() => {
    setFkSource(undefined);
    setFkTarget(undefined);
    setEditMessage(undefined);
  }, []);

  const cancelFkMode = useCallback(() => {
    setFkMode(false);
    resetFkSelection();
  }, [resetFkSelection]);

  const onColumnSelect = useCallback(
    (tableKey: string, columnName: string) => {
      if (!fkMode) return;
      setEditMessage(undefined);

      const table = payload?.tables.find((t) => t.key === tableKey);
      const column = table?.columns.find((c) => c.name === columnName);
      if (!table || !column) return;

      if (fkSource == null) {
        if (table.readOnly) {
          setEditMessage(`${tableKey} is read-only — choose a column on an editable table.`);
          return;
        }
        setFkSource({ tableKey, columnName });
        return;
      }

      if (tableKey === fkSource.tableKey) {
        setFkSource({ tableKey, columnName });
        setFkTarget(undefined);
        return;
      }

      if (!column.isPrimaryKey) {
        setEditMessage("Referenced column must be a primary key.");
        return;
      }

      setFkTarget({ tableKey, columnName });
    },
    [fkMode, fkSource, payload],
  );

  const onConfirmFk = useCallback(() => {
    if (!fkSource || !fkTarget) return;
    setEditMessage(undefined);
    vscode.postMessage({
      type: "addForeignKey",
      intent: {
        fromTableKey: fkSource.tableKey,
        fromColumn: fkSource.columnName,
        toTableKey: fkTarget.tableKey,
        toColumn: fkTarget.columnName,
        constraintName: suggestForeignKeyName(fkSource.tableKey, fkTarget.tableKey),
      },
    });
  }, [fkSource, fkTarget]);

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
        case "editResult":
          if (message.ok) {
            cancelFkMode();
          } else {
            setEditMessage(message.message);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, [cancelFkMode]);

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
        <label className="erdforge-toggle">
          <input
            type="checkbox"
            checked={showDescriptions}
            onChange={(event) => setShowDescriptions(event.target.checked)}
          />
          Show column descriptions
        </label>
        <button
          type="button"
          className={`erdforge-btn${fkMode ? " erdforge-btn--active" : ""}`}
          onClick={() => {
            if (fkMode) {
              cancelFkMode();
            } else {
              setFkMode(true);
              resetFkSelection();
            }
          }}
        >
          {fkMode ? "Adding FK…" : "Add FK"}
        </button>
      </header>
      <div className="erdforge-canvas">
        <ReactFlowProvider>
          <ErdCanvas
            payload={payload}
            showDescriptions={showDescriptions}
            fkMode={fkMode}
            fkSource={fkSource}
            fkTarget={fkTarget}
            editMessage={editMessage}
            onColumnSelect={onColumnSelect}
            onCancelFk={cancelFkMode}
            onConfirmFk={onConfirmFk}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
