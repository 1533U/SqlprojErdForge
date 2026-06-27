/**
 * Headless helpers for multi-candidate (atomic) edit batches — P4-3.
 */

import { existsSync, readFileSync } from "node:fs";
import type { EditValidationResult, FileEditCandidate } from "./types.ts";
import { contentRevision } from "./paths.ts";

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

/** Read current on-disk content for revision comparison (empty string when absent). */
export function readCandidateDiskContent(candidate: FileEditCandidate): string {
  if (candidate.isNewFile) {
    if (existsSync(candidate.absPath)) {
      return readFileSync(candidate.absPath, "utf8");
    }
    return "";
  }

  if (!existsSync(candidate.absPath)) {
    throw new Error(`Source file not found: ${candidate.sourceFile}`);
  }

  return readFileSync(candidate.absPath, "utf8");
}

/**
 * Verify every candidate still matches its preview-time revision before batch apply.
 */
export function validateCandidateBatch(
  candidates: FileEditCandidate[],
): EditValidationResult {
  if (candidates.length === 0) {
    return { ok: false, message: "No edit candidates to apply." };
  }

  for (const candidate of candidates) {
    if (candidate.isNewFile) {
      if (existsSync(candidate.absPath)) {
        return {
          ok: false,
          message: `File already exists: ${candidate.sourceFile}. Discard and retry the edit from the ERD.`,
        };
      }
      continue;
    }

    if (candidate.isDeleteFile) {
      if (!existsSync(candidate.absPath)) {
        return {
          ok: false,
          message: `File already deleted: ${candidate.sourceFile}. Discard and retry the edit from the ERD.`,
        };
      }
    }

    let diskContent: string;
    try {
      diskContent = readCandidateDiskContent(candidate);
    } catch {
      return {
        ok: false,
        message: `Source file not found: ${candidate.sourceFile}. Discard and retry the edit from the ERD.`,
      };
    }

    if (contentRevision(diskContent) !== candidate.originalRevision) {
      return {
        ok: false,
        message: `${candidate.sourceFile} changed since the preview was generated. Discard and retry the edit from the ERD.`,
      };
    }
  }

  return { ok: true, candidates };
}

/** True when an edit should use Refactor Preview instead of the diff editor. */
export function usesRefactorPreview(candidates: FileEditCandidate[]): boolean {
  return candidates.length > 1;
}
