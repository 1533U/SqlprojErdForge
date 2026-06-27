/**
 * Serializable ERD graph payload shared by the extension host and webview.
 */

export interface GraphColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  /** Member trailing comment (`-- …` on the column line); shown on the ERD when enabled. */
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
