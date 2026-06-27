/**
 * ELK auto-layout and grid fallback for diagram tables (P1-3).
 */

import ElkConstructor from "elkjs";
import type { ElkNode } from "elkjs";
import type { GraphEdge, GraphTable, LayoutFile } from "../protocol/graphPayload.ts";

const elk = new ElkConstructor();

const NODE_WIDTH = 280;
const ROW_HEIGHT = 22;
const DESCRIPTION_ROW_HEIGHT = 18;
const HEADER_HEIGHT = 36;
const PADDING = 12;

function estimateNodeHeight(table: GraphTable): number {
  const descriptionRows = table.columns.filter((c) => c.description).length;
  return (
    HEADER_HEIGHT +
    table.columns.length * ROW_HEIGHT +
    descriptionRows * DESCRIPTION_ROW_HEIGHT +
    PADDING
  );
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
