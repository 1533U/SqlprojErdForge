import { ReactFlowProvider } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import { ErdCanvas } from "./canvas/ErdCanvas";
import type { FlowCallbacks, FlowViewInput } from "./canvas/flowModel";
import {
  appendOp,
  clearDraft,
  clearSelection,
  draftOps,
  initialSession,
  projectDraft,
  pruneAppliedEntries,
  removeDraftEntry,
  resolveFkOp,
  selectColumn,
  selectTable,
  withMessage,
  type SessionState,
} from "./session";
import type { AddColumnIntent, DraftOp, GraphPayload, GraphTable, HostToWebviewMessage } from "./types";
import { vscode } from "./vscodeApi";

function findColumn(tables: GraphTable[], tableKey: string, columnName: string) {
  return tables.find((t) => t.key === tableKey)?.columns.find((c) => c.name === columnName);
}

export function App(): ReactElement {
  const [payload, setPayload] = useState<GraphPayload | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [session, setSession] = useState<SessionState>(initialSession);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const ops = useMemo(() => draftOps(session), [session]);
  const projection = useMemo(
    () => (payload ? projectDraft(payload.tables, ops) : { tables: [], provisionalEdges: [] }),
    [payload, ops],
  );

  // Append an op built from the current optimistic projection (so stacked edits compose).
  const appendBuilt = useCallback(
    (build: (tables: GraphTable[]) => DraftOp | { error: string }) => {
      setSession((current) => {
        if (!payload) return current;
        const projected = projectDraft(payload.tables, draftOps(current)).tables;
        const result = build(projected);
        if ("error" in result) return withMessage(current, result.error);
        return appendOp(current, result);
      });
    },
    [payload],
  );

  const onSelectTable = useCallback((tableKey: string) => {
    setSession((s) => selectTable(s, tableKey));
  }, []);

  const onSelectColumn = useCallback((tableKey: string, columnName: string) => {
    setSession((s) => selectColumn(s, tableKey, columnName));
  }, []);

  const onPaneClick = useCallback(() => {
    setSession((s) => clearSelection(s));
  }, []);

  const onRenameColumn = useCallback(
    (tableKey: string, oldName: string, newName: string) => {
      appendBuilt(() => ({ type: "renameColumn", intent: { tableKey, oldName, newName } }));
    },
    [appendBuilt],
  );

  const onChangeType = useCallback(
    (tableKey: string, columnName: string, dataType: string) => {
      appendBuilt((tables) => {
        const column = findColumn(tables, tableKey, columnName);
        if (!column) return { error: `Column ${columnName} not found.` };
        return { type: "changeColumn", intent: { tableKey, columnName, dataType, nullable: column.nullable } };
      });
    },
    [appendBuilt],
  );

  const onToggleNullable = useCallback(
    (tableKey: string, columnName: string) => {
      appendBuilt((tables) => {
        const column = findColumn(tables, tableKey, columnName);
        if (!column) return { error: `Column ${columnName} not found.` };
        return {
          type: "changeColumn",
          intent: { tableKey, columnName, dataType: column.dataType, nullable: !column.nullable },
        };
      });
    },
    [appendBuilt],
  );

  const onEditComment = useCallback(
    (tableKey: string, columnName: string, comment: string) => {
      appendBuilt(() => ({ type: "editComment", intent: { tableKey, columnName, comment } }));
    },
    [appendBuilt],
  );

  const onRemoveColumn = useCallback(
    (tableKey: string, columnName: string) => {
      appendBuilt(() => ({ type: "removeColumn", intent: { tableKey, columnName } }));
    },
    [appendBuilt],
  );

  const onAddColumn = useCallback(
    (intent: AddColumnIntent) => {
      appendBuilt(() => ({ type: "addColumn", intent }));
    },
    [appendBuilt],
  );

  const onConnectColumns = useCallback(
    (fromTableKey: string, fromColumn: string, toTableKey: string, toColumn: string | undefined) => {
      setSession((current) => {
        if (!payload) return current;
        const projected = projectDraft(payload.tables, draftOps(current)).tables;
        const result = resolveFkOp(projected, fromTableKey, fromColumn, toTableKey, toColumn);
        if (!result.ok) return withMessage(current, result.message);
        return appendOp(current, result.op);
      });
    },
    [payload],
  );

  const onReview = useCallback(() => {
    const current = sessionRef.current;
    if (current.draft.length === 0) return;
    vscode.postMessage({ type: "applyDraft", ops: draftOps(current) });
  }, []);

  const onDiscard = useCallback(() => {
    setSession((s) => clearDraft(s));
  }, []);

  const onRemoveEntry = useCallback((id: number) => {
    setSession((s) => removeDraftEntry(s, id));
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostToWebviewMessage>): void => {
      const message = event.data;
      switch (message.type) {
        case "graph":
          setError(undefined);
          setPayload(message.payload);
          setSession((s) => {
            const remaining = pruneAppliedEntries(message.payload.tables, s.draft);
            return remaining.length === s.draft.length ? s : { ...s, draft: remaining };
          });
          break;
        case "error":
          setError(message.message);
          break;
        case "editResult":
          if (message.ok) {
            setSession((s) =>
              withMessage(s, "Combined diff opened — apply it in the editor to write changes."),
            );
          } else {
            setSession((s) => withMessage(s, message.message));
          }
          break;
        default: {
          const _exhaustive: never = message;
          return _exhaustive;
        }
      }
    };

    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const callbacks: FlowCallbacks = useMemo(
    () => ({
      onSelectTable,
      onSelectColumn,
      onRenameColumn,
      onChangeType,
      onToggleNullable,
      onEditComment,
      onRemoveColumn,
      onAddColumn,
    }),
    [
      onSelectTable,
      onSelectColumn,
      onRenameColumn,
      onChangeType,
      onToggleNullable,
      onEditComment,
      onRemoveColumn,
      onAddColumn,
    ],
  );

  const view: FlowViewInput | undefined = useMemo(() => {
    if (!payload) return undefined;
    return {
      tables: projection.tables,
      edges: payload.edges,
      provisionalEdges: projection.provisionalEdges,
      layout: payload.layout,
      showDescriptions,
      selectedTableKey: session.selectedTableKey,
      selectedColumn: session.selectedColumn,
      callbacks,
    };
  }, [payload, projection, showDescriptions, session.selectedTableKey, session.selectedColumn, callbacks]);

  if (error) {
    return (
      <div className="erdforge-shell erdforge-error">
        <h1>ErdForge</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!payload || !view) {
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
        <span className="erdforge-hint">
          Click a table to edit its columns · drag from a column to a primary key to add a foreign key
        </span>
        <label className="erdforge-toggle">
          <input
            type="checkbox"
            checked={showDescriptions}
            onChange={(event) => setShowDescriptions(event.target.checked)}
          />
          Show column descriptions
        </label>
      </header>
      <div className="erdforge-canvas">
        <ReactFlowProvider>
          <ErdCanvas
            view={view}
            draft={session.draft}
            message={session.message}
            onConnectColumns={onConnectColumns}
            onPaneClick={onPaneClick}
            onReview={onReview}
            onDiscard={onDiscard}
            onRemoveEntry={onRemoveEntry}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
