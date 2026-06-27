/**
 * Layout sidecar read/write (P1-5 / ADR-0005).
 *
 * Diagram presentation lives in `.erdforge/layout.json`, keyed by `schema.table`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { LayoutFile, TableLayout } from "./protocol/graphPayload.ts";

export type { LayoutFile, TableLayout };

export const LAYOUT_RELATIVE_PATH = join(".erdforge", "layout.json");

export function layoutPathForProject(projectPath: string): string {
  return join(dirname(projectPath), LAYOUT_RELATIVE_PATH);
}

export function emptyLayout(): LayoutFile {
  return { version: 1, tables: {} };
}

export function readLayout(projectPath: string): LayoutFile {
  const path = layoutPathForProject(projectPath);
  if (!existsSync(path)) {
    return emptyLayout();
  }
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as LayoutFile;
    if (parsed.version !== 1 || typeof parsed.tables !== "object") {
      return emptyLayout();
    }
    return parsed;
  } catch {
    return emptyLayout();
  }
}

export function writeLayout(projectPath: string, layout: LayoutFile): void {
  const path = layoutPathForProject(projectPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(layout, null, 2)}\n`, "utf8");
}

export function mergeTablePosition(
  layout: LayoutFile,
  tableKey: string,
  x: number,
  y: number,
): LayoutFile {
  const existing = layout.tables[tableKey];
  return {
    ...layout,
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
