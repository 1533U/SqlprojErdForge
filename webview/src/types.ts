export type {
  GraphColumn,
  GraphEdge,
  GraphPayload,
  GraphTable,
  LayoutFile,
  TableLayout,
} from "../../src/protocol/graphPayload";

export type {
  AddColumnIntent,
  AddForeignKeyIntent,
  HostToWebviewMessage,
  RemoveColumnIntent,
  RenameColumnIntent,
  WebviewToHostMessage,
} from "../../src/protocol/messages";

export { suggestForeignKeyName } from "../../src/edits/naming";

export interface ColumnRef {
  tableKey: string;
  columnName: string;
}

export type EditMode = "none" | "addFk" | "addColumn" | "removeColumn" | "renameColumn";

export interface NewColumnDraft {
  name: string;
  dataType: string;
  nullable: boolean;
  description: string;
}

export const defaultNewColumnDraft = (): NewColumnDraft => ({
  name: "",
  dataType: "INT",
  nullable: true,
  description: "",
});

export interface EditSessionState {
  mode: EditMode;
  fkSource: ColumnRef | undefined;
  fkTarget: ColumnRef | undefined;
  addColumnTableKey: string | undefined;
  removeColumnTarget: ColumnRef | undefined;
  renameColumnTarget: ColumnRef | undefined;
  renameNewName: string;
  newColumn: NewColumnDraft;
  message: string | undefined;
}

export const initialEditSession = (): EditSessionState => ({
  mode: "none",
  fkSource: undefined,
  fkTarget: undefined,
  addColumnTableKey: undefined,
  removeColumnTarget: undefined,
  renameColumnTarget: undefined,
  renameNewName: "",
  newColumn: defaultNewColumnDraft(),
  message: undefined,
});

export function resetEditSelection(session: EditSessionState): EditSessionState {
  return {
    ...session,
    fkSource: undefined,
    fkTarget: undefined,
    addColumnTableKey: undefined,
    removeColumnTarget: undefined,
    renameColumnTarget: undefined,
    renameNewName: "",
    newColumn: defaultNewColumnDraft(),
    message: undefined,
  };
}
