/**
 * Fold an ordered draft of column-level edits into a single combined edit preview.
 *
 * The webview accumulates direct-manipulation edits (inline column changes,
 * drag-to-link FKs) into an ordered {@link DraftOp}[] and applies them as one
 * batch. Each op is threaded through the existing `apply*ToModel` mutators over a
 * clone, so validation runs against the intermediate model (e.g. add a column,
 * then rename it). Touched tables are diffed by canonical emit, and the whole
 * batch becomes one {@link EditValidationResult} via {@link buildFileEditCandidates}
 * — reusing the same diff-preview / Refactor Preview / conflict-detection pipeline.
 */

import type { ProjectModel } from "../model.ts";
import { assertNever } from "../model.ts";
import { emitTable } from "../emitter.ts";
import { applyAddColumnToModel } from "./addColumn.ts";
import { applyAddForeignKeyToModel } from "./addForeignKey.ts";
import { applyChangeColumnToModel } from "./changeColumn.ts";
import { applyEditCommentToModel } from "./editComment.ts";
import { applyRemoveColumnToModel } from "./removeColumn.ts";
import { applyRenameColumnToModel } from "./renameColumn.ts";
import { buildFileEditCandidates } from "./candidate.ts";
import type { DraftOp, EditValidationResult } from "./types.ts";

function applyDraftOp(model: ProjectModel, op: DraftOp): ProjectModel {
  switch (op.type) {
    case "addColumn":
      return applyAddColumnToModel(model, op.intent);
    case "removeColumn":
      return applyRemoveColumnToModel(model, op.intent);
    case "renameColumn":
      return applyRenameColumnToModel(model, op.intent);
    case "changeColumn":
      return applyChangeColumnToModel(model, op.intent);
    case "editComment":
      return applyEditCommentToModel(model, op.intent);
    case "addForeignKey":
      return applyAddForeignKeyToModel(model, op.intent);
    default:
      return assertNever(op);
  }
}

/** Fold an ordered draft into one combined edit preview, or reject naming the failing op. */
export function foldDraft(model: ProjectModel, ops: DraftOp[]): EditValidationResult {
  if (ops.length === 0) {
    return { ok: false, message: "No pending edits to apply." };
  }

  let current = model;
  for (let i = 0; i < ops.length; i++) {
    try {
      current = applyDraftOp(current, ops[i] as DraftOp);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `Edit ${i + 1} of ${ops.length} failed: ${message}` };
    }
  }

  // Touched tables = those whose canonical emit changed. This naturally captures
  // multi-file effects (e.g. renameColumn updating inbound FK REFERENCES).
  const touched: string[] = [];
  for (const [key, original] of model.tables) {
    const mutated = current.tables.get(key);
    if (!mutated) continue;
    if (emitTable(original) !== emitTable(mutated)) touched.push(key);
  }

  if (touched.length === 0) {
    return { ok: false, message: "No effective changes to apply." };
  }

  return buildFileEditCandidates(model, current, touched);
}
