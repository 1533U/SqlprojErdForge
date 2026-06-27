/**
 * Build edit candidates after mutating cloned table models.
 */

import { emitTable } from "../emitter.ts";
import type { ProjectModel, Table } from "../model.ts";
import { contentRevision, readTableSource, tableAbsPath } from "./paths.ts";
import type { EditValidationResult, FileEditCandidate } from "./types.ts";

export function buildFileEditCandidate(
  originalModel: ProjectModel,
  mutatedTable: Table,
  tableKey: string,
): EditValidationResult {
  const originalTable = originalModel.tables.get(tableKey);
  if (!originalTable) {
    return { ok: false, message: `Table not found: ${tableKey}` };
  }

  let originalContent: string;
  try {
    originalContent = readTableSource(originalModel.projectPath, originalTable);
  } catch {
    return { ok: false, message: `Source file not found for ${tableKey}` };
  }

  return {
    ok: true,
    candidates: [
      {
        absPath: tableAbsPath(originalModel.projectPath, originalTable),
        sourceFile: originalTable.sourceFile,
        originalContent,
        candidateContent: emitTable(mutatedTable),
        originalRevision: contentRevision(originalContent),
      },
    ],
  };
}

export function buildFileEditCandidates(
  originalModel: ProjectModel,
  mutatedModel: ProjectModel,
  tableKeys: Iterable<string>,
  owningTableKey?: string,
): EditValidationResult {
  const ordered = orderTableKeys(tableKeys, owningTableKey);
  const candidates: FileEditCandidate[] = [];

  for (const tableKey of ordered) {
    const table = mutatedModel.tables.get(tableKey);
    const originalTable = originalModel.tables.get(tableKey);
    if (!table || !originalTable) {
      return { ok: false, message: `Table not found: ${tableKey}` };
    }

    let originalContent: string;
    try {
      originalContent = readTableSource(originalModel.projectPath, originalTable);
    } catch {
      return { ok: false, message: `Source file not found for ${tableKey}` };
    }

    candidates.push({
      absPath: tableAbsPath(originalModel.projectPath, originalTable),
      sourceFile: originalTable.sourceFile,
      originalContent,
      candidateContent: emitTable(table),
      originalRevision: contentRevision(originalContent),
    });
  }

  return { ok: true, candidates };
}

function orderTableKeys(tableKeys: Iterable<string>, owningTableKey?: string): string[] {
  const keys = [...new Set(tableKeys)];
  keys.sort((a, b) => a.localeCompare(b));
  if (owningTableKey && keys.includes(owningTableKey)) {
    return [owningTableKey, ...keys.filter((key) => key !== owningTableKey)];
  }
  return keys;
}
