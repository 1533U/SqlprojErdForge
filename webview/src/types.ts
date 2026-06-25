export interface GraphColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
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

export type HostToWebviewMessage =
  | { type: "graph"; payload: GraphPayload }
  | { type: "error"; message: string };

export type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "layoutUpdate"; tableKey: string; x: number; y: number };
