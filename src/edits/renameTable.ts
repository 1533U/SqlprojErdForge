/**
 * Rename a table (file + .sqlproj + layout key + inbound FK REFERENCES) — P3-7.
 */

import { existsSync, readFileSync } from "node:fs";

import { emitTable } from "../emitter.ts";
import {
  layoutPathForProject,
  LAYOUT_RELATIVE_PATH,
  migrateLayoutEntry,
  readLayout,
} from "../layout.ts";
import type { ProjectModel } from "../model.ts";
import { contentRevision, includeAbsPath, readTableSource, tableAbsPath } from "./paths.ts";
import { cloneProjectModel } from "./cloneModel.ts";
import {
  findInboundFkReferencesToTable,
  splitTableKey,
  tableKeyFromParts,
  validateEditableTable,
  validateSchemaName,
  validateTableName,
} from "./memberChecks.ts";
import {
  buildIncludeExists,
  renameTableIncludePath,
  replaceBuildInclude,
} from "./sqlprojEdit.ts";
import type { EditValidationResult, FileEditCandidate, RenameTableParams } from "./types.ts";

export function prepareRenameTable(
  model: ProjectModel,
  params: RenameTableParams,
): EditValidationResult {
  const validation = validateRenameTable(model, params);
  if (!validation.ok) return validation;

  const normalized = normalizeRenameTableParams(model, params);
  const mutated = cloneProjectModel(model);
  const touchedKeys = applyRenameTableMutation(mutated, normalized);
  return buildRenameTableCandidates(model, mutated, normalized, touchedKeys);
}

export function applyRenameTableToModel(
  model: ProjectModel,
  params: RenameTableParams,
): ProjectModel {
  const validation = validateRenameTable(model, params);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const normalized = normalizeRenameTableParams(model, params);
  const mutated = cloneProjectModel(model);
  applyRenameTableMutation(mutated, normalized);
  return mutated;
}

interface NormalizedRenameTableParams {
  oldTableKey: string;
  newTableKey: string;
  oldSchema: string;
  oldTableName: string;
  newSchema: string;
  newTableName: string;
  oldSourceFile: string;
  newSourceFile: string;
}

function normalizeRenameTableParams(
  model: ProjectModel,
  params: RenameTableParams,
): NormalizedRenameTableParams {
  const oldTableKey = params.tableKey.trim();
  const table = model.tables.get(oldTableKey);
  if (!table) {
    throw new Error(`Table not found: ${oldTableKey}`);
  }

  const [oldSchema, oldTableName] = splitTableKey(oldTableKey);
  const newSchema = params.newSchema?.trim() ?? oldSchema;
  const newTableName = params.newTableName.trim();
  const newTableKey = tableKeyFromParts(newSchema, newTableName);
  const newSourceFile = renameTableIncludePath(table.sourceFile, newSchema, newTableName);

  return {
    oldTableKey,
    newTableKey,
    oldSchema,
    oldTableName,
    newSchema,
    newTableName,
    oldSourceFile: table.sourceFile,
    newSourceFile,
  };
}

export function applyRenameTableMutation(
  model: ProjectModel,
  params: NormalizedRenameTableParams,
): Set<string> {
  const table = model.tables.get(params.oldTableKey);
  if (!table) {
    throw new Error(`Table not found: ${params.oldTableKey}`);
  }

  const touched = new Set<string>([params.newTableKey]);

  table.schema = params.newSchema;
  table.name = params.newTableName;
  table.sourceFile = params.newSourceFile;

  model.tables.delete(params.oldTableKey);
  model.tables.set(params.newTableKey, table);

  propagateInboundFkTableRenames(
    model,
    params.oldSchema,
    params.oldTableName,
    params.newSchema,
    params.newTableName,
    touched,
  );

  return touched;
}

function propagateInboundFkTableRenames(
  model: ProjectModel,
  oldSchema: string,
  oldTableName: string,
  newSchema: string,
  newTableName: string,
  touched: Set<string>,
): void {
  for (const [fromKey, fromTable] of model.tables) {
    let fromTableTouched = false;

    for (const member of fromTable.members) {
      if (member.kind !== "constraint" || member.constraintType !== "foreignKey") continue;
      const refSchema = member.references.schema ?? "dbo";
      if (refSchema !== oldSchema || member.references.table !== oldTableName) continue;

      member.references.table = newTableName;
      if (member.references.schema === oldSchema && newSchema !== oldSchema) {
        member.references.schema = newSchema;
      }
      fromTableTouched = true;
    }

    if (fromTableTouched) {
      touched.add(fromKey);
    }
  }
}

function buildRenameTableCandidates(
  originalModel: ProjectModel,
  mutatedModel: ProjectModel,
  params: NormalizedRenameTableParams,
  touchedKeys: Set<string>,
): EditValidationResult {
  const candidates: FileEditCandidate[] = [];
  const originalTable = originalModel.tables.get(params.oldTableKey);
  const mutatedTable = mutatedModel.tables.get(params.newTableKey);
  if (!originalTable || !mutatedTable) {
    return { ok: false, message: `Table not found: ${params.oldTableKey}` };
  }

  let originalContent: string;
  try {
    originalContent = readTableSource(originalModel.projectPath, originalTable);
  } catch {
    return { ok: false, message: `Source file not found for ${params.oldTableKey}.` };
  }

  candidates.push({
    absPath: tableAbsPath(originalModel.projectPath, originalTable),
    sourceFile: originalTable.sourceFile,
    originalContent,
    candidateContent: "",
    originalRevision: contentRevision(originalContent),
    isDeleteFile: true,
  });

  const newAbsPath = includeAbsPath(originalModel.projectPath, params.newSourceFile);
  if (existsSync(newAbsPath)) {
    return {
      ok: false,
      message: `File already exists: ${params.newSourceFile}`,
    };
  }

  candidates.push({
    absPath: newAbsPath,
    sourceFile: params.newSourceFile,
    originalContent: "",
    candidateContent: emitTable(mutatedTable),
    originalRevision: contentRevision(""),
    isNewFile: true,
  });

  const referencingKeys = [...touchedKeys]
    .filter((key) => key !== params.newTableKey)
    .sort((a, b) => a.localeCompare(b));

  for (const tableKey of referencingKeys) {
    const table = mutatedModel.tables.get(tableKey);
    const sourceTable = originalModel.tables.get(tableKey);
    if (!table || !sourceTable) {
      return { ok: false, message: `Table not found: ${tableKey}` };
    }

    let refOriginalContent: string;
    try {
      refOriginalContent = readTableSource(originalModel.projectPath, sourceTable);
    } catch {
      return { ok: false, message: `Source file not found for ${tableKey}` };
    }

    candidates.push({
      absPath: tableAbsPath(originalModel.projectPath, sourceTable),
      sourceFile: sourceTable.sourceFile,
      originalContent: refOriginalContent,
      candidateContent: emitTable(table),
      originalRevision: contentRevision(refOriginalContent),
    });
  }

  const sqlprojPath = originalModel.projectPath;
  let sqlprojOriginal = "";
  try {
    sqlprojOriginal = readFileSync(sqlprojPath, "utf8");
  } catch {
    return { ok: false, message: "Could not read the .sqlproj file." };
  }

  if (buildIncludeExists(sqlprojOriginal, params.oldSourceFile)) {
    candidates.push({
      absPath: sqlprojPath,
      sourceFile: sqlprojPath.split(/[/\\]/).pop() ?? ".sqlproj",
      originalContent: sqlprojOriginal,
      candidateContent: replaceBuildInclude(
        sqlprojOriginal,
        params.oldSourceFile,
        params.newSourceFile,
      ),
      originalRevision: contentRevision(sqlprojOriginal),
    });
  }

  const layoutPath = layoutPathForProject(originalModel.projectPath);
  const currentLayout = readLayout(originalModel.projectPath);
  if (currentLayout.tables[params.oldTableKey]) {
    const layoutOriginal = existsSync(layoutPath) ? readFileSync(layoutPath, "utf8") : "";
    const updatedLayout = migrateLayoutEntry(
      currentLayout,
      params.oldTableKey,
      params.newTableKey,
    );
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

function validateRenameTable(
  model: ProjectModel,
  params: RenameTableParams,
): EditValidationResult | { ok: true } {
  const oldTableKey = params.tableKey.trim();
  if (!oldTableKey) {
    return { ok: false, message: "Table key is required." };
  }

  const newTableName = params.newTableName.trim();
  const tableNameResult = validateTableName(newTableName);
  if (!tableNameResult.ok) return tableNameResult;

  const newSchemaInput = params.newSchema?.trim();
  if (newSchemaInput) {
    const schemaResult = validateSchemaName(newSchemaInput);
    if (!schemaResult.ok) return schemaResult;
  }

  const tableResult = validateEditableTable(model.tables.get(oldTableKey), oldTableKey);
  if (!tableResult.ok) return tableResult;

  const [oldSchema, oldTableName] = splitTableKey(oldTableKey);
  const newSchema = newSchemaInput ?? oldSchema;
  const newTableKey = tableKeyFromParts(newSchema, newTableName);

  if (oldSchema === newSchema && oldTableName === newTableName) {
    return { ok: false, message: "New table name must differ from the current name." };
  }

  if (model.tables.has(newTableKey)) {
    return { ok: false, message: `Table ${newTableKey} already exists in the project.` };
  }

  const newSourceFile = renameTableIncludePath(tableResult.table.sourceFile, newSchema, newTableName);
  const newAbsPath = includeAbsPath(model.projectPath, newSourceFile);
  if (existsSync(newAbsPath)) {
    return { ok: false, message: `File already exists: ${newSourceFile}` };
  }

  try {
    readTableSource(model.projectPath, tableResult.table);
  } catch {
    return { ok: false, message: `Source file not found for ${oldTableKey}.` };
  }

  for (const inbound of findInboundFkReferencesToTable(model, oldTableKey)) {
    const refTableResult = validateEditableTable(
      model.tables.get(inbound.fromTableKey),
      inbound.fromTableKey,
    );
    if (!refTableResult.ok) {
      return {
        ok: false,
        message: `${refTableResult.message} (references ${oldTableKey} via ${inbound.constraintName}).`,
      };
    }
  }

  return { ok: true };
}
