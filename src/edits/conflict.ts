/**
 * Conflict detection on concurrent file changes (P4-4 / ADR-0014).
 *
 * A {@link FileEditCandidate} is a snapshot taken at preview time
 * (`originalContent` + `originalRevision`). Before any apply we recompute the
 * revision against the *current* on-disk content so a file that changed (or was
 * created/deleted) since the preview fails closed rather than silently
 * overwriting newer content. Detection is pure and shared by the single-file
 * diff-apply path and the multi-file Refactor Preview batch path.
 */

import { existsSync, readFileSync } from "node:fs";
import { contentRevision } from "./paths.ts";
import type { FileEditCandidate } from "./types.ts";

export type CandidateConflict =
  | { kind: "none" }
  /** On-disk content changed since the preview was generated. */
  | { kind: "fileChanged"; sourceFile: string }
  /** A replace/delete target no longer exists on disk. */
  | { kind: "fileMissing"; sourceFile: string }
  /** A new-file target was created on disk since the preview was generated. */
  | { kind: "fileAlreadyExists"; sourceFile: string }
  /** A delete target was already removed since the preview was generated. */
  | { kind: "fileAlreadyDeleted"; sourceFile: string };

/** Recompute a single candidate's revision against current disk content. */
export function detectCandidateConflict(candidate: FileEditCandidate): CandidateConflict {
  if (candidate.isNewFile) {
    if (existsSync(candidate.absPath)) {
      return { kind: "fileAlreadyExists", sourceFile: candidate.sourceFile };
    }
    return { kind: "none" };
  }

  if (candidate.isDeleteFile && !existsSync(candidate.absPath)) {
    return { kind: "fileAlreadyDeleted", sourceFile: candidate.sourceFile };
  }

  if (!existsSync(candidate.absPath)) {
    return { kind: "fileMissing", sourceFile: candidate.sourceFile };
  }

  let diskContent: string;
  try {
    diskContent = readFileSync(candidate.absPath, "utf8");
  } catch {
    return { kind: "fileMissing", sourceFile: candidate.sourceFile };
  }

  if (contentRevision(diskContent) !== candidate.originalRevision) {
    return { kind: "fileChanged", sourceFile: candidate.sourceFile };
  }

  return { kind: "none" };
}

/** Return the first candidate conflict in a batch, or `none`. */
export function detectBatchConflict(candidates: FileEditCandidate[]): CandidateConflict {
  for (const candidate of candidates) {
    const conflict = detectCandidateConflict(candidate);
    if (conflict.kind !== "none") return conflict;
  }
  return { kind: "none" };
}

export function hasConflict(conflict: CandidateConflict): boolean {
  return conflict.kind !== "none";
}

/** User-facing message; empty string when there is no conflict. */
export function conflictMessage(conflict: CandidateConflict): string {
  switch (conflict.kind) {
    case "none":
      return "";
    case "fileChanged":
      return `${conflict.sourceFile} changed since the preview was generated. Recompute the preview to apply against the latest content.`;
    case "fileMissing":
      return `${conflict.sourceFile} no longer exists. Recompute the preview to continue.`;
    case "fileAlreadyExists":
      return `${conflict.sourceFile} was created since the preview was generated. Recompute the preview to continue.`;
    case "fileAlreadyDeleted":
      return `${conflict.sourceFile} was already deleted since the preview was generated. Recompute the preview to continue.`;
    default: {
      const _exhaustive: never = conflict;
      return _exhaustive;
    }
  }
}
