import type { ReactNode } from "react";
import { suggestForeignKeyName } from "../types";
import type { EditSessionState } from "../types";

export function EditBanner({
  edit,
  onNewColumnChange,
  onConfirmFk,
  onConfirmAddColumn,
  onConfirmRemoveColumn,
  onConfirmRenameColumn,
  onConfirmChangeColumn,
  onRenameNewNameChange,
  onChangeColumnDraftChange,
  onCancel,
}: {
  edit: EditSessionState;
  onNewColumnChange: (patch: Partial<EditSessionState["newColumn"]>) => void;
  onConfirmFk: () => void;
  onConfirmAddColumn: () => void;
  onConfirmRemoveColumn: () => void;
  onConfirmRenameColumn: () => void;
  onConfirmChangeColumn: () => void;
  onRenameNewNameChange: (name: string) => void;
  onChangeColumnDraftChange: (patch: Partial<EditSessionState["changeColumnDraft"]>) => void;
  onCancel: () => void;
}) {
  if (edit.mode === "none") return null;

  const constraintName =
    edit.fkSource && edit.fkTarget
      ? suggestForeignKeyName(edit.fkSource.tableKey, edit.fkTarget.tableKey)
      : undefined;

  let body: ReactNode;
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
    case "changeColumn":
      if (edit.changeColumnTarget == null) {
        body = <span>Click a column to change its type or nullability.</span>;
      } else {
        body = (
          <span className="erdforge-edit-banner__form">
            Change <strong>{edit.changeColumnTarget.tableKey}.{edit.changeColumnTarget.columnName}</strong>
            <label>
              Type
              <input
                type="text"
                value={edit.changeColumnDraft.dataType}
                onChange={(event) => onChangeColumnDraftChange({ dataType: event.target.value })}
                placeholder="INT"
              />
            </label>
            <label className="erdforge-edit-banner__checkbox">
              <input
                type="checkbox"
                checked={edit.changeColumnDraft.nullable}
                onChange={(event) => onChangeColumnDraftChange({ nullable: event.target.checked })}
              />
              Nullable
            </label>
          </span>
        );
        confirmLabel = "Preview change";
        onConfirm = onConfirmChangeColumn;
        confirmEnabled =
          edit.changeColumnOriginal != null &&
          edit.changeColumnDraft.dataType.trim().length > 0 &&
          (edit.changeColumnDraft.dataType.trim() !== edit.changeColumnOriginal.dataType ||
            edit.changeColumnDraft.nullable !== edit.changeColumnOriginal.nullable);
      }
      break;
    default: {
      const _exhaustive: never = edit.mode;
      body = _exhaustive;
      break;
    }
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
