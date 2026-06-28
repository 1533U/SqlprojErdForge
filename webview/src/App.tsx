import { ReactFlowProvider } from "@xyflow/react";
import { useCallback, useEffect, useState } from "react";

import {
  selectColumnForAddFk,
  selectColumnForChangeColumn,
  selectColumnForEditComment,
  selectColumnForRemove,
  selectColumnForRename,
  selectTableForAddColumn,
  selectTableForDrop,
  selectTableForRename,
  validateAddTableForm,
  validateRenameTableForm,
  inboundFkWarningForDrop,
} from "../../src/edits/editInteraction";
import { ErdCanvas } from "./canvas/ErdCanvas";
import { EditMenu } from "./EditMenu";
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

  const onChangeColumnDraftChange = useCallback(
    (patch: Partial<EditSessionState["changeColumnDraft"]>) => {
      setEdit((current) => ({
        ...current,
        message: undefined,
        changeColumnDraft: { ...current.changeColumnDraft, ...patch },
      }));
    },
    [],
  );

  const onEditCommentDraftChange = useCallback((comment: string) => {
    setEdit((current) => ({
      ...current,
      message: undefined,
      editCommentDraft: comment,
    }));
  }, []);

  const onAddTableChange = useCallback(
    (patch: Partial<Pick<EditSessionState, "addTableSchema" | "addTableName">>) => {
      setEdit((current) => ({
        ...current,
        message: undefined,
        ...patch,
      }));
    },
    [],
  );

  const onRenameTableChange = useCallback(
    (patch: Partial<Pick<EditSessionState, "renameTableSchema" | "renameTableNewName">>) => {
      setEdit((current) => ({
        ...current,
        message: undefined,
        ...patch,
      }));
    },
    [],
  );

  const onTableSelect = useCallback(
    (tableKey: string) => {
      setEdit((current) => {
        const table = payload?.tables.find((t) => t.key === tableKey);

        if (current.mode === "addColumn") {
          const result = selectTableForAddColumn(table, tableKey);
          if (!result.ok) {
            return { ...current, message: result.message };
          }
          return { ...current, message: undefined, addColumnTableKey: result.tableKey };
        }

        if (current.mode === "dropTable") {
          const result = selectTableForDrop(table, tableKey);
          if (!result.ok) {
            return { ...current, message: result.message };
          }
          const dropTableWarning = payload
            ? inboundFkWarningForDrop(payload.edges, result.tableKey)
            : undefined;
          return {
            ...current,
            message: undefined,
            dropTableTarget: result.tableKey,
            dropTableWarning,
          };
        }

        if (current.mode === "renameTable") {
          const result = selectTableForRename(table, tableKey);
          if (!result.ok) {
            return { ...current, message: result.message };
          }
          return {
            ...current,
            message: undefined,
            renameTableTarget: result.tableKey,
            renameTableSchema: result.schema,
            renameTableNewName: "",
          };
        }

        return current;
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
          const result = selectColumnForAddFk(table, column, {
            fkSource: current.fkSource,
            fkTarget: current.fkTarget,
          });
          if (!result.ok) {
            return { ...current, message: result.message };
          }
          return {
            ...current,
            message: undefined,
            fkSource: result.fkSource,
            fkTarget: result.fkTarget,
          };
        }

        if (current.mode === "removeColumn") {
          const result = selectColumnForRemove(table, column);
          if (!result.ok) {
            return { ...current, message: result.message };
          }
          return {
            ...current,
            message: undefined,
            removeColumnTarget: result.target,
          };
        }

        if (current.mode === "renameColumn") {
          const result = selectColumnForRename(table, columnName);
          if (!result.ok) {
            return { ...current, message: result.message };
          }
          return {
            ...current,
            message: undefined,
            renameColumnTarget: result.target,
            renameNewName: "",
          };
        }

        if (current.mode === "changeColumn") {
          const result = selectColumnForChangeColumn(table, column);
          if (!result.ok) {
            return { ...current, message: result.message };
          }
          return {
            ...current,
            message: undefined,
            changeColumnTarget: result.target,
            changeColumnOriginal: {
              dataType: result.dataType,
              nullable: result.nullable,
            },
            changeColumnDraft: {
              dataType: result.dataType,
              nullable: result.nullable,
            },
          };
        }

        if (current.mode === "editComment") {
          const result = selectColumnForEditComment(table, column, column.description);
          if (!result.ok) {
            return { ...current, message: result.message };
          }
          return {
            ...current,
            message: undefined,
            editCommentTarget: result.target,
            editCommentOriginal: result.comment,
            editCommentDraft: result.comment,
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

  const onConfirmChangeColumn = useCallback(() => {
    setEdit((current) => {
      if (!current.changeColumnTarget) return current;
      const dataType = current.changeColumnDraft.dataType.trim();
      if (!dataType) return current;
      vscode.postMessage({
        type: "changeColumn",
        intent: {
          tableKey: current.changeColumnTarget.tableKey,
          columnName: current.changeColumnTarget.columnName,
          dataType,
          nullable: current.changeColumnDraft.nullable,
        },
      });
      return { ...current, message: undefined };
    });
  }, []);

  const onConfirmEditComment = useCallback(() => {
    setEdit((current) => {
      if (!current.editCommentTarget) return current;
      if (current.editCommentOriginal == null) return current;
      if (current.editCommentDraft.trim() === current.editCommentOriginal.trim()) {
        return current;
      }
      vscode.postMessage({
        type: "editComment",
        intent: {
          tableKey: current.editCommentTarget.tableKey,
          columnName: current.editCommentTarget.columnName,
          comment: current.editCommentDraft.trim(),
        },
      });
      return { ...current, message: undefined };
    });
  }, []);

  const onConfirmAddTable = useCallback(() => {
    setEdit((current) => {
      const tables = payload?.tables ?? [];
      const result = validateAddTableForm(
        tables,
        current.addTableSchema,
        current.addTableName,
      );
      if (!result.ok) {
        return { ...current, message: result.message };
      }
      vscode.postMessage({
        type: "addTable",
        intent: {
          schema: current.addTableSchema.trim(),
          tableName: current.addTableName.trim(),
        },
      });
      return { ...current, message: undefined };
    });
  }, [payload]);

  const onConfirmDropTable = useCallback(() => {
    setEdit((current) => {
      if (!current.dropTableTarget) return current;
      vscode.postMessage({
        type: "dropTable",
        intent: { tableKey: current.dropTableTarget },
      });
      return { ...current, message: undefined };
    });
  }, []);

  const onConfirmRenameTable = useCallback(() => {
    setEdit((current) => {
      if (!current.renameTableTarget) return current;
      const tables = payload?.tables ?? [];
      const result = validateRenameTableForm(
        tables,
        current.renameTableTarget,
        current.renameTableSchema,
        current.renameTableNewName,
      );
      if (!result.ok) {
        return { ...current, message: result.message };
      }
      vscode.postMessage({
        type: "renameTable",
        intent: {
          tableKey: current.renameTableTarget,
          newTableName: current.renameTableNewName.trim(),
          newSchema: current.renameTableSchema.trim(),
        },
      });
      return { ...current, message: undefined };
    });
  }, [payload]);

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
        default: {
          const _exhaustive: never = message;
          return _exhaustive;
        }
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
        <EditMenu activeMode={edit.mode} onSelect={startEditMode} />
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
            onConfirmChangeColumn={onConfirmChangeColumn}
            onConfirmEditComment={onConfirmEditComment}
            onConfirmAddTable={onConfirmAddTable}
            onConfirmDropTable={onConfirmDropTable}
            onConfirmRenameTable={onConfirmRenameTable}
            onRenameNewNameChange={onRenameNewNameChange}
            onChangeColumnDraftChange={onChangeColumnDraftChange}
            onEditCommentDraftChange={onEditCommentDraftChange}
            onAddTableChange={onAddTableChange}
            onRenameTableChange={onRenameTableChange}
            onCancelEdit={cancelEditMode}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
