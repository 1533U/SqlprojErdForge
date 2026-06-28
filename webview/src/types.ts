import type { ColumnRef, EditMode } from "../../src/edits/editInteraction";

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
  AddTableIntent,
  DropTableIntent,
  ChangeColumnIntent,
  EditCommentIntent,
  HostToWebviewMessage,
  RemoveColumnIntent,
  RenameColumnIntent,
  RenameTableIntent,
  WebviewToHostMessage,
} from "../../src/protocol/messages";

export type { ColumnRef, EditMode };
export { suggestForeignKeyName } from "../../src/edits/naming";

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

export interface ChangeColumnDraft {
  dataType: string;
  nullable: boolean;
}

export const defaultChangeColumnDraft = (): ChangeColumnDraft => ({
  dataType: "INT",
  nullable: true,
});

export interface EditSessionState {
  mode: EditMode;
  fkSource: ColumnRef | undefined;
  fkTarget: ColumnRef | undefined;
  addColumnTableKey: string | undefined;
  removeColumnTarget: ColumnRef | undefined;
  renameColumnTarget: ColumnRef | undefined;
  renameNewName: string;
  changeColumnTarget: ColumnRef | undefined;
  changeColumnOriginal: ChangeColumnDraft | undefined;
  changeColumnDraft: ChangeColumnDraft;
  editCommentTarget: ColumnRef | undefined;
  editCommentOriginal: string | undefined;
  editCommentDraft: string;
  newColumn: NewColumnDraft;
  addTableSchema: string;
  addTableName: string;
  dropTableTarget: string | undefined;
  dropTableWarning: string | undefined;
  renameTableTarget: string | undefined;
  renameTableSchema: string;
  renameTableNewName: string;
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
  changeColumnTarget: undefined,
  changeColumnOriginal: undefined,
  changeColumnDraft: defaultChangeColumnDraft(),
  editCommentTarget: undefined,
  editCommentOriginal: undefined,
  editCommentDraft: "",
  newColumn: defaultNewColumnDraft(),
  addTableSchema: "dbo",
  addTableName: "",
  dropTableTarget: undefined,
  dropTableWarning: undefined,
  renameTableTarget: undefined,
  renameTableSchema: "dbo",
  renameTableNewName: "",
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
    changeColumnTarget: undefined,
    changeColumnOriginal: undefined,
    changeColumnDraft: defaultChangeColumnDraft(),
    editCommentTarget: undefined,
    editCommentOriginal: undefined,
    editCommentDraft: "",
    newColumn: defaultNewColumnDraft(),
    addTableSchema: "dbo",
    addTableName: "",
    dropTableTarget: undefined,
    dropTableWarning: undefined,
    renameTableTarget: undefined,
    renameTableSchema: "dbo",
    renameTableNewName: "",
    message: undefined,
  };
}
