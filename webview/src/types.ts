export interface GraphColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  description?: string;
}

export interface GraphTable {
  key: string;
  schema: string;
  name: string;
  readOnly: boolean;
  columns: GraphColumn[];
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface TableLayout {
  x: number;
  y: number;
  collapsed?: boolean;
  color?: string;
}

export interface LayoutFile {
  version: 1;
  tables: Record<string, TableLayout>;
}

export interface GraphPayload {
  projectName: string;
  tables: GraphTable[];
  edges: GraphEdge[];
  layout: LayoutFile;
}

export interface AddForeignKeyIntent {
  fromTableKey: string;
  fromColumn: string;
  toTableKey: string;
  toColumn: string;
  constraintName: string;
}

export type HostToWebviewMessage =
  | { type: "graph"; payload: GraphPayload }
  | { type: "error"; message: string }
  | { type: "editResult"; ok: true }
  | { type: "editResult"; ok: false; message: string };

export type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "layoutUpdate"; tableKey: string; x: number; y: number }
  | { type: "addForeignKey"; intent: AddForeignKeyIntent };

export interface ColumnRef {
  tableKey: string;
  columnName: string;
}

export function suggestForeignKeyName(fromTableKey: string, toTableKey: string): string {
  const from = tableShortName(fromTableKey);
  const to = tableShortName(toTableKey);
  return `FK_${from}_${to}`;
}

function tableShortName(tableKey: string): string {
  const dot = tableKey.indexOf(".");
  return dot === -1 ? tableKey : tableKey.slice(dot + 1);
}
