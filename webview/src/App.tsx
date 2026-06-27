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
  EditMode,
  EditSessionState,
  GraphPayload,
  HostToWebviewMessage,
  WebviewToHostMessage,
} from "./types";
import {
  initialEditSession,
  resetEditSelection,
  suggestForeignKeyName,
} from "./types";

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

function EditBanner({
  edit,
  onNewColumnChange,
  onConfirmFk,
  onConfirmAddColumn,
  onConfirmRemoveColumn,
  onConfirmRenameColumn,
  onRenameNewNameChange,
  onCancel,
}: {
  edit: EditSessionState;
  onNewColumnChange: (patch: Partial<EditSessionState["newColumn"]>) => void;
  onConfirmFk: () => void;
  onConfirmAddColumn: () => void;
  onConfirmRemoveColumn: () => void;
  onConfirmRenameColumn: () => void;
  onRenameNewNameChange: (name: string) => void;
  onCancel: () => void;
}) {
  if (edit.mode === "none") return null;

  const constraintName =
    edit.fkSource && edit.fkTarget
      ? suggestForeignKeyName(edit.fkSource.tableKey, edit.fkTarget.tableKey)
      : undefined;

  let body: React.ReactNode;
  let confirmLabel: string | undefined;
  let onConfirm: (() => void) | undefined;
  let confirmEnabled = false;

  switch (edit.mode) {
    case "addFk":
      if (edit.fkSource == null) {
        body = <span>Click a column on the table that will hold the foreign key.</span>;
      } else if (edit.fkTarget == null) {
        body = (
          <span>
            Source: <strong>{edit.fkSource.tableKey}.{edit.fkSource.columnName}</strong> — now click a
            primary-key column on the referenced table.
          </span>
        );
      } else {
        body = (
          <span>
            {edit.fkSource.tableKey}.{edit.fkSource.columnName} → {edit.fkTarget.tableKey}.{edit.fkTarget.columnName}
            {constraintName ? ` (${constraintName})` : null}
          </span>
        );
        confirmLabel = "Preview FK";
        onConfirm = onConfirmFk;
        confirmEnabled = true;
      }
      break;
    case "addColumn":
      if (edit.addColumnTableKey == null) {
        body = <span>Click a table header to choose where to add a column.</span>;
      } else {
        body = (
          <span className="erdforge-edit-banner__form">
            <strong>{edit.addColumnTableKey}</strong>
            <label>
              Name
              <input
                type="text"
                value={edit.newColumn.name}
                onChange={(event) => onNewColumnChange({ name: event.target.value })}
                placeholder="column_name"
              />
            </label>
            <label>
              Type
              <input
                type="text"
                value={edit.newColumn.dataType}
                onChange={(event) => onNewColumnChange({ dataType: event.target.value })}
                placeholder="INT"
              />
            </label>
            <label className="erdforge-edit-banner__checkbox">
              <input
                type="checkbox"
                checked={edit.newColumn.nullable}
                onChange={(event) => onNewColumnChange({ nullable: event.target.checked })}
              />
              Nullable
            </label>
            <label>
              Description
              <input
                type="text"
                value={edit.newColumn.description}
                onChange={(event) => onNewColumnChange({ description: event.target.value })}
                placeholder="optional trailing comment"
              />
            </label>
          </span>
        );
        confirmLabel = "Preview column";
        onConfirm = onConfirmAddColumn;
        confirmEnabled =
          edit.newColumn.name.trim().length > 0 && edit.newColumn.dataType.trim().length > 0;
      }
      break;
    case "removeColumn":
      if (edit.removeColumnTarget == null) {
        body = (
          <span>
            Click a column to remove (PK and FK columns cannot be removed).
          </span>
        );
      } else {
        body = (
          <span>
            Remove <strong>{edit.removeColumnTarget.tableKey}.{edit.removeColumnTarget.columnName}</strong>?
          </span>
        );
        confirmLabel = "Preview remove";
        onConfirm = onConfirmRemoveColumn;
        confirmEnabled = true;
      }
      break;
    case "renameColumn":
      if (edit.renameColumnTarget == null) {
        body = <span>Click a column to rename.</span>;
      } else {
        body = (
          <span className="erdforge-edit-banner__form">
            Rename <strong>{edit.renameColumnTarget.tableKey}.{edit.renameColumnTarget.columnName}</strong>
            <label>
              New name
              <input
                type="text"
                value={edit.renameNewName}
                onChange={(event) => onRenameNewNameChange(event.target.value)}
                placeholder="new_column_name"
              />
            </label>
          </span>
        );
        confirmLabel = "Preview rename";
        onConfirm = onConfirmRenameColumn;
        confirmEnabled = edit.renameNewName.trim().length > 0;
      }
      break;
    default:
      body = null;
      break;
  }

  return (
    <div className="erdforge-edit-banner">
      {body}
      {edit.message ? <span className="erdforge-edit-banner__error">{edit.message}</span> : null}
      <span className="erdforge-edit-banner__actions">
        {confirmEnabled && onConfirm && confirmLabel ? (
          <button type="button" className="erdforge-btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
        ) : null}
        <button type="button" className="erdforge-btn erdforge-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </span>
    </div>
  );
}

function ErdCanvas({
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
  onRenameNewNameChange,
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
  onRenameNewNameChange: (name: string) => void;
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
        onRenameNewNameChange={onRenameNewNameChange}
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

export function App() {
  const [payload, setPayload] = useState<GraphPayload | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [edit, setEdit] = useState<EditSessionState>(initialEditSession);

  const cancelEditMode = useCallback(() => {
    setEdit(initialEditSession());
  }, []);

  const startEditMode = useCallback((mode: EditMode) => {
    setEdit((current) => {
      if (current.mode === mode) {
        return initialEditSession();
      }
      return { ...resetEditSelection(current), mode };
    });
  }, []);

  const onNewColumnChange = useCallback((patch: Partial<EditSessionState["newColumn"]>) => {
    setEdit((current) => ({
      ...current,
      message: undefined,
      newColumn: { ...current.newColumn, ...patch },
    }));
  }, []);

  const onRenameNewNameChange = useCallback((name: string) => {
    setEdit((current) => ({
      ...current,
      message: undefined,
      renameNewName: name,
    }));
  }, []);

  const onTableSelect = useCallback(
    (tableKey: string) => {
      setEdit((current) => {
        if (current.mode !== "addColumn") return current;

        const table = payload?.tables.find((t) => t.key === tableKey);
        if (!table) return { ...current, message: undefined };
        if (table.readOnly) {
          return {
            ...current,
            message: `${tableKey} is read-only — choose an editable table.`,
          };
        }

        return { ...current, message: undefined, addColumnTableKey: tableKey };
      });
    },
    [payload],
  );

  const onColumnSelect = useCallback(
    (tableKey: string, columnName: string) => {
      setEdit((current) => {
        const table = payload?.tables.find((t) => t.key === tableKey);
        const column = table?.columns.find((c) => c.name === columnName);
        if (!table || !column) return { ...current, message: undefined };

        if (current.mode === "addFk") {
          if (current.fkSource == null) {
            if (table.readOnly) {
              return {
                ...current,
                message: `${tableKey} is read-only — choose a column on an editable table.`,
              };
            }
            return {
              ...current,
              message: undefined,
              fkSource: { tableKey, columnName },
            };
          }

          if (tableKey === current.fkSource.tableKey) {
            return {
              ...current,
              message: undefined,
              fkSource: { tableKey, columnName },
              fkTarget: undefined,
            };
          }

          if (!column.isPrimaryKey) {
            return { ...current, message: "Referenced column must be a primary key." };
          }

          return {
            ...current,
            message: undefined,
            fkTarget: { tableKey, columnName },
          };
        }

        if (current.mode === "removeColumn") {
          if (table.readOnly) {
            return { ...current, message: `${tableKey} is read-only.` };
          }
          if (column.isPrimaryKey || column.isForeignKey) {
            return { ...current, message: "Cannot remove a PK or FK column." };
          }
          return {
            ...current,
            message: undefined,
            removeColumnTarget: { tableKey, columnName },
          };
        }

        if (current.mode === "renameColumn") {
          if (table.readOnly) {
            return { ...current, message: `${tableKey} is read-only.` };
          }
          return {
            ...current,
            message: undefined,
            renameColumnTarget: { tableKey, columnName },
            renameNewName: "",
          };
        }

        return { ...current, message: undefined };
      });
    },
    [payload],
  );

  const onConfirmFk = useCallback(() => {
    setEdit((current) => {
      if (!current.fkSource || !current.fkTarget) return current;
      vscode.postMessage({
        type: "addForeignKey",
        intent: {
          fromTableKey: current.fkSource.tableKey,
          fromColumn: current.fkSource.columnName,
          toTableKey: current.fkTarget.tableKey,
          toColumn: current.fkTarget.columnName,
          constraintName: suggestForeignKeyName(current.fkSource.tableKey, current.fkTarget.tableKey),
        },
      });
      return { ...current, message: undefined };
    });
  }, []);

  const onConfirmAddColumn = useCallback(() => {
    setEdit((current) => {
      if (!current.addColumnTableKey) return current;
      vscode.postMessage({
        type: "addColumn",
        intent: {
          tableKey: current.addColumnTableKey,
          columnName: current.newColumn.name.trim(),
          dataType: current.newColumn.dataType.trim(),
          nullable: current.newColumn.nullable,
          ...(current.newColumn.description.trim()
            ? { trailingComment: current.newColumn.description.trim() }
            : {}),
        },
      });
      return { ...current, message: undefined };
    });
  }, []);

  const onConfirmRemoveColumn = useCallback(() => {
    setEdit((current) => {
      if (!current.removeColumnTarget) return current;
      vscode.postMessage({
        type: "removeColumn",
        intent: {
          tableKey: current.removeColumnTarget.tableKey,
          columnName: current.removeColumnTarget.columnName,
        },
      });
      return { ...current, message: undefined };
    });
  }, []);

  const onConfirmRenameColumn = useCallback(() => {
    setEdit((current) => {
      if (!current.renameColumnTarget) return current;
      const newName = current.renameNewName.trim();
      if (!newName) return current;
      vscode.postMessage({
        type: "renameColumn",
        intent: {
          tableKey: current.renameColumnTarget.tableKey,
          oldName: current.renameColumnTarget.columnName,
          newName,
        },
      });
      return { ...current, message: undefined };
    });
  }, []);

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
            cancelEditMode();
          } else {
            setEdit((current) => ({ ...current, message: message.message }));
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, [cancelEditMode]);

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
          className={`erdforge-btn${edit.mode === "addFk" ? " erdforge-btn--active" : ""}`}
          onClick={() => startEditMode("addFk")}
        >
          {edit.mode === "addFk" ? "Adding FK…" : "Add FK"}
        </button>
        <button
          type="button"
          className={`erdforge-btn${edit.mode === "addColumn" ? " erdforge-btn--active" : ""}`}
          onClick={() => startEditMode("addColumn")}
        >
          {edit.mode === "addColumn" ? "Adding column…" : "Add column"}
        </button>
        <button
          type="button"
          className={`erdforge-btn${edit.mode === "removeColumn" ? " erdforge-btn--active" : ""}`}
          onClick={() => startEditMode("removeColumn")}
        >
          {edit.mode === "removeColumn" ? "Removing column…" : "Remove column"}
        </button>
        <button
          type="button"
          className={`erdforge-btn${edit.mode === "renameColumn" ? " erdforge-btn--active" : ""}`}
          onClick={() => startEditMode("renameColumn")}
        >
          {edit.mode === "renameColumn" ? "Renaming column…" : "Rename column"}
        </button>
      </header>
      <div className="erdforge-canvas">
        <ReactFlowProvider>
          <ErdCanvas
            payload={payload}
            showDescriptions={showDescriptions}
            edit={edit}
            onNewColumnChange={onNewColumnChange}
            onColumnSelect={onColumnSelect}
            onTableSelect={onTableSelect}
            onConfirmFk={onConfirmFk}
            onConfirmAddColumn={onConfirmAddColumn}
            onConfirmRemoveColumn={onConfirmRemoveColumn}
            onConfirmRenameColumn={onConfirmRenameColumn}
            onRenameNewNameChange={onRenameNewNameChange}
            onCancelEdit={cancelEditMode}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
