/**
 * Build a single-file edit candidate after mutating a cloned table model.
 */

import { emitTable } from "../emitter.ts";
import type { ProjectModel, Table } from "../model.ts";
import { contentRevision, readTableSource, tableAbsPath } from "./paths.ts";
import type { EditValidationResult, FileEditCandidate } from "./types.ts";

export function buildFileEditCandidate(
  model: ProjectModel,
  table: Table,
  tableKey: string,
): EditValidationResult {
  let originalContent: string;
  try {
    originalContent = readTableSource(model.projectPath, table);
  } catch {
    return { ok: false, message: `Source file not found for ${tableKey}` };
  }

  const candidate: FileEditCandidate = {
    absPath: tableAbsPath(model.projectPath, table),
    sourceFile: table.sourceFile,
    originalContent,
    candidateContent: emitTable(table),
    originalRevision: contentRevision(originalContent),
  };

  return { ok: true, candidate };
}
