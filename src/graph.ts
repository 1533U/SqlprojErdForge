/**
 * Convert a ProjectModel into a serializable ERD graph for the webview, and run ELK
 * auto-layout for tables missing layout entries (P1-2 / P1-3).
 */

import ElkConstructor from "elkjs";
import type { ElkNode } from "elkjs";
import type { Edge, ProjectModel, Table } from "./model.ts";
import { assertNever } from "./model.ts";
import { buildEdges } from "./erd.ts";
import type { LayoutFile, TableLayout } from "./layout.ts";
import { emptyLayout } from "./layout.ts";

const elk = new ElkConstructor();

const NODE_WIDTH = 280;
const ROW_HEIGHT = 22;
const HEADER_HEIGHT = 36;
const PADDING = 12;

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

export interface GraphPayload {
  projectName: string;
  tables: GraphTable[];
  edges: GraphEdge[];
  layout: LayoutFile;
}

function estimateNodeHeight(table: GraphTable): number {
  return HEADER_HEIGHT + table.columns.length * ROW_HEIGHT + PADDING;
}

function tableToGraph(table: Table): GraphTable {
  const pkColumns = new Set<string>();
  const fkColumns = new Set<string>();

  for (const member of table.members) {
    if (member.kind !== "constraint") continue;
    switch (member.constraintType) {
      case "primaryKey":
        for (const col of member.columns) pkColumns.add(col);
        break;
      case "foreignKey":
        for (const col of member.columns) fkColumns.add(col);
        break;
      case "unique":
      case "check":
        break;
      default:
        assertNever(member);
    }
  }

  const columns: GraphColumn[] = [];
  for (const member of table.members) {
    if (member.kind !== "column") continue;
    columns.push({
      name: member.name,
      dataType: member.dataType,
      nullable: member.nullable,
      isPrimaryKey: pkColumns.has(member.name),
      isForeignKey: fkColumns.has(member.name),
    });
  }

  return {
    key: `${table.schema}.${table.name}`,
    schema: table.schema,
    name: table.name,
    readOnly: table.readOnly,
    columns,
  };
}

function edgesToGraph(edges: Edge[]): GraphEdge[] {
  return edges.map((edge, index) => ({
    id: `fk-${index}-${edge.constraintName}`,
    from: edge.from,
    to: edge.to,
    label: edge.constraintName,
  }));
}

/** ELK/React Flow require both endpoints to exist as nodes (C10 edges may reference tables outside the project). */
export function filterEdgesToKnownTables(
  edges: GraphEdge[],
  tableKeys: ReadonlySet<string>,
): GraphEdge[] {
  return edges.filter((edge) => tableKeys.has(edge.from) && tableKeys.has(edge.to));
}

function fallbackGridLayout(tables: GraphTable[], layout: LayoutFile): LayoutFile {
  const merged: LayoutFile = { version: 1, tables: { ...layout.tables } };
  const cols = 4;
  const xGap = NODE_WIDTH + 40;
  const yGap = 180;
  let index = 0;

  for (const table of tables) {
    if (merged.tables[table.key]) continue;
    const col = index % cols;
    const row = Math.floor(index / cols);
    merged.tables[table.key] = { x: col * xGap, y: row * yGap };
    index++;
  }

  return merged;
}

export async function buildGraphPayload(
  model: ProjectModel,
  existingLayout: LayoutFile = emptyLayout(),
): Promise<GraphPayload> {
  const tables = [...model.tables.values()]
    .map(tableToGraph)
    .sort((a, b) => a.key.localeCompare(b.key));
  const tableKeys = new Set(tables.map((t) => t.key));
  const edges = filterEdgesToKnownTables(edgesToGraph(buildEdges(model)), tableKeys);
  const layout = await layoutWithElk(tables, edges, existingLayout);
  const projectName = model.projectPath.split(/[/\\]/).pop()?.replace(/\.sqlproj$/i, "") ?? "ERD";

  return { projectName, tables, edges, layout };
}

export async function layoutWithElk(
  tables: GraphTable[],
  edges: GraphEdge[],
  layout: LayoutFile,
): Promise<LayoutFile> {
  if (tables.length === 0) {
    return layout;
  }

  const unpositioned = tables.filter((t) => !layout.tables[t.key]);
  if (unpositioned.length === 0) {
    return layout;
  }

  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "48",
      "elk.layered.spacing.nodeNodeBetweenLayers": "64",
    },
    children: tables.map((table) => ({
      id: table.key,
      width: NODE_WIDTH,
      height: estimateNodeHeight(table),
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.from],
      targets: [edge.to],
    })),
  };

  let result: ElkNode;
  try {
    result = await elk.layout(elkGraph as ElkNode);
  } catch {
    return fallbackGridLayout(unpositioned, layout);
  }
  const merged: LayoutFile = {
    version: 1,
    tables: { ...layout.tables },
  };

  for (const child of result.children ?? []) {
    if (!child.id || child.x == null || child.y == null) continue;
    if (merged.tables[child.id]) continue;
    merged.tables[child.id] = {
      x: child.x,
      y: child.y,
    };
  }

  return merged;
}

export function applyLayoutUpdate(
  layout: LayoutFile,
  tableKey: string,
  x: number,
  y: number,
): LayoutFile {
  const existing: TableLayout | undefined = layout.tables[tableKey];
  return {
    version: 1,
    tables: {
      ...layout.tables,
      [tableKey]: {
        ...existing,
        x,
        y,
      },
    },
  };
}
