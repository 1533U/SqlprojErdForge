/**
 * Drop a table (delete .sql file + .sqlproj build item + layout entry) — P3-6.
 */

import { existsSync, readFileSync } from "node:fs";

import {
  layoutPathForProject,
  LAYOUT_RELATIVE_PATH,
  readLayout,
  removeLayoutEntry,
} from "../layout.ts";
import type { ProjectModel, Table } from "../model.ts";
import { tableAbsPath, readTableSource, contentRevision } from "./paths.ts";
import { cloneProjectModel } from "./cloneModel.ts";
import { validateEditableTable } from "./memberChecks.ts";
import { buildIncludeExists, removeBuildInclude } from "./sqlprojEdit.ts";
import type { DropTableParams, EditValidationResult, FileEditCandidate } from "./types.ts";

export function prepareDropTable(
  model: ProjectModel,
  params: DropTableParams,
): EditValidationResult {
  const validation = validateDropTable(model, params);
  if (!validation.ok) return validation;

  const tableKey = params.tableKey.trim();
  const table = model.tables.get(tableKey);
  if (!table) {
    return { ok: false, message: `Table not found: ${tableKey}` };
  }

  const mutated = cloneProjectModel(model);
  mutated.tables.delete(tableKey);
  return buildDropTableCandidates(model, table, tableKey);
}

export function applyDropTableToModel(model: ProjectModel, params: DropTableParams): ProjectModel {
  const validation = validateDropTable(model, params);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const mutated = cloneProjectModel(model);
  mutated.tables.delete(params.tableKey.trim());
  return mutated;
}

export function validateDropTable(
  model: ProjectModel,
  params: DropTableParams,
): EditValidationResult | { ok: true } {
  const tableKey = params.tableKey.trim();
  if (!tableKey) {
    return { ok: false, message: "Table key is required." };
  }

  const tableResult = validateEditableTable(model.tables.get(tableKey), tableKey);
  if (!tableResult.ok) return tableResult;

  try {
    readTableSource(model.projectPath, tableResult.table);
  } catch {
    return { ok: false, message: `Source file not found for ${tableKey}.` };
  }

  return { ok: true };
}

function buildDropTableCandidates(
  model: ProjectModel,
  table: Table,
  tableKey: string,
): EditValidationResult {
  const candidates: FileEditCandidate[] = [];

  let originalContent: string;
  try {
    originalContent = readTableSource(model.projectPath, table);
  } catch {
    return { ok: false, message: `Source file not found for ${tableKey}.` };
  }

  candidates.push({
    absPath: tableAbsPath(model.projectPath, table),
    sourceFile: table.sourceFile,
    originalContent,
    candidateContent: "",
    originalRevision: contentRevision(originalContent),
    isDeleteFile: true,
  });

  const sqlprojPath = model.projectPath;
  let sqlprojOriginal = "";
  try {
    sqlprojOriginal = readFileSync(sqlprojPath, "utf8");
  } catch {
    return { ok: false, message: "Could not read the .sqlproj file." };
  }

  if (buildIncludeExists(sqlprojOriginal, table.sourceFile)) {
    candidates.push({
      absPath: sqlprojPath,
      sourceFile: sqlprojPath.split(/[/\\]/).pop() ?? ".sqlproj",
      originalContent: sqlprojOriginal,
      candidateContent: removeBuildInclude(sqlprojOriginal, table.sourceFile),
      originalRevision: contentRevision(sqlprojOriginal),
    });
  }

  const layoutPath = layoutPathForProject(model.projectPath);
  const currentLayout = readLayout(model.projectPath);
  if (currentLayout.tables[tableKey]) {
    const layoutOriginal = existsSync(layoutPath) ? readFileSync(layoutPath, "utf8") : "";
    const updatedLayout = removeLayoutEntry(currentLayout, tableKey);
    candidates.push({
      absPath: layoutPath,
      sourceFile: LAYOUT_RELATIVE_PATH,
      originalContent: layoutOriginal,
      candidateContent: `${JSON.stringify(updatedLayout, null, 2)}\n`,
      originalRevision: contentRevision(layoutOriginal),
    });
  }

  return { ok: true, candidates };
}
