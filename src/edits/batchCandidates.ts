/**
 * Headless helpers for multi-candidate (atomic) edit batches — P4-3.
 */

import type { EditValidationResult, FileEditCandidate } from "./types.ts";
import { conflictMessage, detectBatchConflict } from "./conflict.ts";

export interface RenamePair {
  deleteCandidate: FileEditCandidate;
  createCandidate: FileEditCandidate;
}

/** Group delete+create candidates that share a renamePairKey. */
export function findRenamePairs(candidates: FileEditCandidate[]): Map<string, RenamePair> {
  const pairs = new Map<string, RenamePair>();

  for (const candidate of candidates) {
    if (!candidate.isDeleteFile || !candidate.renamePairKey) continue;

    const createCandidate = candidates.find(
      (other) =>
        other.isNewFile &&
        other.renamePairKey === candidate.renamePairKey &&
        other !== candidate,
    );
    if (!createCandidate) continue;

    pairs.set(candidate.renamePairKey, {
      deleteCandidate: candidate,
      createCandidate,
    });
  }

  return pairs;
}

/** Human-readable label for a Refactor Preview tree entry. */
export function candidateEditLabel(candidate: FileEditCandidate): string {
  if (candidate.isDeleteFile && candidate.renamePairKey) {
    return `Rename ${candidate.sourceFile}`;
  }
  if (candidate.isDeleteFile) {
    return `Delete ${candidate.sourceFile}`;
  }
  if (candidate.isNewFile) {
    return `Create ${candidate.sourceFile}`;
  }
  if (candidate.sourceFile.endsWith(".sqlproj")) {
    return "Update .sqlproj";
  }
  if (candidate.sourceFile.includes("layout.json")) {
    return "Update layout";
  }
  return `Update ${candidate.sourceFile}`;
}

/**
 * Verify every candidate still matches its preview-time revision before batch apply.
 * Delegates conflict detection to the shared {@link detectBatchConflict} (P4-4).
 */
export function validateCandidateBatch(
  candidates: FileEditCandidate[],
): EditValidationResult {
  if (candidates.length === 0) {
    return { ok: false, message: "No edit candidates to apply." };
  }

  const conflict = detectBatchConflict(candidates);
  if (conflict.kind !== "none") {
    return { ok: false, message: conflictMessage(conflict) };
  }

  return { ok: true, candidates };
}

/** True when an edit should use Refactor Preview instead of the diff editor. */
export function usesRefactorPreview(candidates: FileEditCandidate[]): boolean {
  return candidates.length > 1;
}
