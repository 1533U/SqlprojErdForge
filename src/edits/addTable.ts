/**
 * Add a new table (new .sql file + .sqlproj build item + layout entry) — P3-5.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";

import { emitTable } from "../emitter.ts";
import {
  applyLayoutUpdate,
  layoutPathForProject,
  LAYOUT_RELATIVE_PATH,
  readLayout,
} from "../layout.ts";
import type { Column, PrimaryKeyConstraint, ProjectModel, Table } from "../model.ts";
import { contentRevision } from "./paths.ts";
import { cloneProjectModel } from "./cloneModel.ts";
import {
  tableKeyFromParts,
  validateSchemaName,
  validateTableName,
} from "./memberChecks.ts";
import {
  suggestIdColumnName,
  suggestPrimaryKeyName,
} from "./naming.ts";
import { buildIncludeExists, insertBuildInclude, tableIncludePath } from "./sqlprojEdit.ts";
import type { AddTableParams, EditValidationResult, FileEditCandidate } from "./types.ts";

const DEFAULT_LAYOUT_X = 120;
const DEFAULT_LAYOUT_Y = 120;

export function prepareAddTable(
  model: ProjectModel,
  params: AddTableParams,
): EditValidationResult {
  const validation = validateAddTable(model, params);
  if (!validation.ok) return validation;

  const normalized = normalizeAddTableParams(model, params);
  const mutated = cloneProjectModel(model);
  const table = buildNewTable(normalized);
  mutated.tables.set(tableKeyFromParts(normalized.schema, normalized.tableName), table);

  return buildAddTableCandidates(model, table, normalized);
}

export function applyAddTableToModel(model: ProjectModel, params: AddTableParams): ProjectModel {
  const validation = validateAddTable(model, params);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const normalized = normalizeAddTableParams(model, params);
  const mutated = cloneProjectModel(model);
  const table = buildNewTable(normalized);
  mutated.tables.set(tableKeyFromParts(normalized.schema, normalized.tableName), table);
  return mutated;
}

export function validateAddTable(
  model: ProjectModel,
  params: AddTableParams,
): EditValidationResult | { ok: true } {
  const schemaResult = validateSchemaName(params.schema);
  if (!schemaResult.ok) return schemaResult;

  const tableResult = validateTableName(params.tableName);
  if (!tableResult.ok) return tableResult;

  const schema = params.schema.trim();
  const tableName = params.tableName.trim();
  const tableKey = tableKeyFromParts(schema, tableName);

  if (model.tables.has(tableKey)) {
    return { ok: false, message: `Table ${tableKey} already exists in the project.` };
  }

  const normalized = normalizeAddTableParams(model, params);
  const absPath = tableAbsPathForInclude(model.projectPath, normalized.sourceFile);
  if (existsSync(absPath)) {
    return {
      ok: false,
      message: `File already exists: ${normalized.sourceFile}`,
    };
  }

  return { ok: true };
}

interface NormalizedAddTableParams {
  schema: string;
  tableName: string;
  sourceFile: string;
  includeFolder: string;
  layoutX: number;
  layoutY: number;
}

function normalizeAddTableParams(
  model: ProjectModel,
  params: AddTableParams,
): NormalizedAddTableParams {
  const schema = params.schema.trim();
  const tableName = params.tableName.trim();
  const includeFolder = params.includeFolder?.trim() ?? inferDefaultIncludeFolder(model);
  const sourceFile = tableIncludePath(includeFolder, schema, tableName);

  return {
    schema,
    tableName,
    sourceFile,
    includeFolder,
    layoutX: params.layoutX ?? DEFAULT_LAYOUT_X,
    layoutY: params.layoutY ?? DEFAULT_LAYOUT_Y,
  };
}

function inferDefaultIncludeFolder(model: ProjectModel): string {
  const counts = new Map<string, number>();
  for (const table of model.tables.values()) {
    if (table.readOnly) continue;
    const folder = folderFromInclude(table.sourceFile);
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  }

  let best = "";
  let bestCount = 0;
  for (const [folder, count] of counts) {
    if (count > bestCount) {
      best = folder;
      bestCount = count;
    }
  }
  return best;
}

function folderFromInclude(include: string): string {
  const normalized = include.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx === -1 ? "" : normalized.slice(0, idx);
}

function buildNewTable(params: NormalizedAddTableParams): Table {
  const idColumnName = suggestIdColumnName(params.tableName);
  const pkName = suggestPrimaryKeyName(params.tableName);

  const idColumn: Column = {
    kind: "column",
    name: idColumnName,
    dataType: "INT",
    nullable: false,
    identity: { seed: 1, increment: 1 },
  };

  const pkConstraint: PrimaryKeyConstraint = {
    kind: "constraint",
    constraintType: "primaryKey",
    name: pkName,
    columns: [idColumnName],
  };

  return {
    schema: params.schema,
    name: params.tableName,
    sourceFile: params.sourceFile,
    members: [idColumn, pkConstraint],
    readOnly: false,
    roundTrippable: true,
  };
}

function buildAddTableCandidates(
  model: ProjectModel,
  table: Table,
  params: NormalizedAddTableParams,
): EditValidationResult {
  const tableKey = tableKeyFromParts(params.schema, params.tableName);
  const candidates: FileEditCandidate[] = [];

  const sqlAbsPath = tableAbsPathForInclude(model.projectPath, table.sourceFile);
  candidates.push({
    absPath: sqlAbsPath,
    sourceFile: table.sourceFile,
    originalContent: "",
    candidateContent: emitTable(table),
    originalRevision: contentRevision(""),
    isNewFile: true,
  });

  const sqlprojPath = model.projectPath;
  let sqlprojOriginal = "";
  try {
    sqlprojOriginal = readFileSync(sqlprojPath, "utf8");
  } catch {
    return { ok: false, message: "Could not read the .sqlproj file." };
  }

  if (!buildIncludeExists(sqlprojOriginal, table.sourceFile)) {
    candidates.push({
      absPath: sqlprojPath,
      sourceFile: sqlprojPath.split(/[/\\]/).pop() ?? ".sqlproj",
      originalContent: sqlprojOriginal,
      candidateContent: insertBuildInclude(sqlprojOriginal, table.sourceFile),
      originalRevision: contentRevision(sqlprojOriginal),
    });
  }

  const layoutPath = layoutPathForProject(model.projectPath);
  const layoutExists = existsSync(layoutPath);
  const currentLayout = readLayout(model.projectPath);
  const updatedLayout = applyLayoutUpdate(
    currentLayout,
    tableKey,
    params.layoutX,
    params.layoutY,
  );
  const layoutOriginal = layoutExists ? readFileSync(layoutPath, "utf8") : "";

  candidates.push({
    absPath: layoutPath,
    sourceFile: LAYOUT_RELATIVE_PATH,
    originalContent: layoutOriginal,
    candidateContent: `${JSON.stringify(updatedLayout, null, 2)}\n`,
    originalRevision: contentRevision(layoutOriginal),
    isNewFile: !layoutExists,
  });

  return { ok: true, candidates };
}

function tableAbsPathForInclude(projectPath: string, include: string): string {
  const relative = include.replace(/\\/g, sep).replace(/\//g, sep);
  return join(dirname(projectPath), relative);
}
