/**
 * Resolve table source files on disk from the project model.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import type { Table } from "../model.ts";

export function tableAbsPath(projectPath: string, table: Table): string {
  const relative = table.sourceFile.replace(/\\/g, sep).replace(/\//g, sep);
  return join(dirname(projectPath), relative);
}

export function readTableSource(projectPath: string, table: Table): string {
  return readFileSync(tableAbsPath(projectPath, table), "utf8");
}

export function contentRevision(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
