import { useCallback, useEffect, useRef, useState } from "react";

import type { EditMode } from "./types";

type EditableMode = Exclude<EditMode, "none">;

interface EditOperationLabel {
  /** Menu-item label, e.g. "Add FK". */
  label: string;
  /** Trigger label while this mode is active, e.g. "Adding FK…". */
  activeLabel: string;
}

/**
 * One label per editable mode. The `Record` makes a new {@link EditMode}
 * variant a compile error until it is given a menu label here.
 */
const EDIT_OPERATION_LABELS: Record<EditableMode, EditOperationLabel> = {
  addFk: { label: "Add FK", activeLabel: "Adding FK…" },
  addColumn: { label: "Add column", activeLabel: "Adding column…" },
  removeColumn: { label: "Remove column", activeLabel: "Removing column…" },
  renameColumn: { label: "Rename column", activeLabel: "Renaming column…" },
  changeColumn: { label: "Change column", activeLabel: "Changing column…" },
  editComment: { label: "Edit comment", activeLabel: "Editing comment…" },
  addTable: { label: "Add table", activeLabel: "Adding table…" },
  dropTable: { label: "Drop table", activeLabel: "Dropping table…" },
  renameTable: { label: "Rename table", activeLabel: "Renaming table…" },
};

const EDIT_MENU_ORDER = Object.keys(EDIT_OPERATION_LABELS) as EditableMode[];

interface EditMenuProps {
  activeMode: EditMode;
  onSelect: (mode: EditMode) => void;
}

export function EditMenu({ activeMode, onSelect }: EditMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const handleSelect = useCallback(
    (mode: EditableMode) => {
      onSelect(mode);
      close();
    },
    [onSelect, close],
  );

  const isActive = activeMode !== "none";
  const triggerLabel = isActive
    ? EDIT_OPERATION_LABELS[activeMode].activeLabel
    : "Edit…";

  return (
    <div className="erdforge-menu" ref={containerRef}>
      <button
        type="button"
        className={`erdforge-btn${isActive ? " erdforge-btn--active" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {triggerLabel} ▾
      </button>
      {open && (
        <ul className="erdforge-menu__list" role="menu">
          {EDIT_MENU_ORDER.map((mode) => (
            <li key={mode} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={activeMode === mode}
                className={`erdforge-menu__item${activeMode === mode ? " erdforge-menu__item--active" : ""}`}
                onClick={() => handleSelect(mode)}
              >
                {EDIT_OPERATION_LABELS[mode].label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
