/**
 * P4-4 conflict-handling verification (headless).
 *
 * Proves the conflict detector fails closed against real on-disk changes for
 * each scenario in the plan: (a) single-file diff apply after the `.sql`
 * changed, (b) multi-file batch where one candidate is stale, and (c) a
 * watcher-driven refresh landing mid-edit (the candidate snapshot diverges from
 * current disk). Uses real temp files so this is not just a compile check.
 */

import { mkdtempSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  conflictMessage,
  detectBatchConflict,
  detectCandidateConflict,
  hasConflict,
} from "../../edits/conflict.ts";
import { contentRevision } from "../../edits/paths.ts";
import { validateCandidateBatch } from "../../edits/batchCandidates.ts";
import type { FileEditCandidate } from "../../edits/types.ts";
import { VerifyHarness } from "../harness.ts";

interface CandidateOverrides {
  isNewFile?: boolean;
  isDeleteFile?: boolean;
}

function makeCandidate(
  absPath: string,
  sourceFile: string,
  originalContent: string,
  overrides: CandidateOverrides = {},
): FileEditCandidate {
  return {
    absPath,
    sourceFile,
    originalContent,
    candidateContent: `${originalContent}\n-- edited`,
    originalRevision: contentRevision(originalContent),
    ...overrides,
  };
}

export function runConflictChecks(): void {
  const h = new VerifyHarness();
  console.log("SqlprojErdForge — P4-4 conflict-handling verification (headless)\n");

  const dir = mkdtempSync(join(tmpdir(), "erdforge-p4-"));
  try {
    runReplaceChecks(h, dir);
    runScenarioC(h, dir);
    runNewFileChecks(h, dir);
    runDeleteChecks(h, dir);
    runBatchChecks(h, dir);
    runMessageChecks(h);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  h.exitWithSummary("ALL P4 CHECKS PASSED", "{n} P4 CHECK(S) FAILED");
}

/** Scenario (a): single-file replace apply after the on-disk file changed. */
function runReplaceChecks(h: VerifyHarness, dir: string): void {
  console.log("Scenario (a) — single-file apply after on-disk change:");
  const file = join(dir, "a.sql");
  writeFileSync(file, "ORIGINAL", "utf8");
  const candidate = makeCandidate(file, "a.sql", "ORIGINAL");

  h.check(
    "unchanged file yields no conflict",
    detectCandidateConflict(candidate).kind === "none",
  );

  writeFileSync(file, "CHANGED ON DISK", "utf8");
  const conflict = detectCandidateConflict(candidate);
  h.check("changed file detected as fileChanged", conflict.kind === "fileChanged");
  h.check(
    "fileChanged names the source file",
    conflict.kind === "fileChanged" && conflict.sourceFile === "a.sql",
  );

  unlinkSync(file);
  h.check(
    "deleted replace target detected as fileMissing",
    detectCandidateConflict(candidate).kind === "fileMissing",
  );
}

/** Scenario (c): watcher refresh mid-edit — snapshot diverges from disk. */
function runScenarioC(h: VerifyHarness, dir: string): void {
  console.log("\nScenario (c) — watcher refresh lands mid-edit:");
  const file = join(dir, "c.sql");
  writeFileSync(file, "SNAPSHOT", "utf8");
  const candidate = makeCandidate(file, "c.sql", "SNAPSHOT");

  // A concurrent change (the event a watcher would surface) lands after preview.
  writeFileSync(file, "SNAPSHOT + concurrent edit", "utf8");
  h.check(
    "stale snapshot caught after concurrent change",
    detectCandidateConflict(candidate).kind === "fileChanged",
  );
}

/** New-file (add table) target created since preview. */
function runNewFileChecks(h: VerifyHarness, dir: string): void {
  console.log("\nNew-file target:");
  const file = join(dir, "new.sql");
  const candidate = makeCandidate(file, "new.sql", "", { isNewFile: true });

  h.check(
    "absent new-file target yields no conflict",
    detectCandidateConflict(candidate).kind === "none",
  );

  writeFileSync(file, "CREATED ELSEWHERE", "utf8");
  h.check(
    "existing new-file target detected as fileAlreadyExists",
    detectCandidateConflict(candidate).kind === "fileAlreadyExists",
  );
}

/** Delete-file (drop table) target. */
function runDeleteChecks(h: VerifyHarness, dir: string): void {
  console.log("\nDelete-file target:");
  const file = join(dir, "del.sql");
  writeFileSync(file, "TO DELETE", "utf8");
  const candidate = makeCandidate(file, "del.sql", "TO DELETE", { isDeleteFile: true });

  h.check(
    "unchanged delete target yields no conflict",
    detectCandidateConflict(candidate).kind === "none",
  );

  writeFileSync(file, "MODIFIED BEFORE DELETE", "utf8");
  h.check(
    "modified delete target detected as fileChanged",
    detectCandidateConflict(candidate).kind === "fileChanged",
  );

  unlinkSync(file);
  h.check(
    "already-removed delete target detected as fileAlreadyDeleted",
    detectCandidateConflict(candidate).kind === "fileAlreadyDeleted",
  );
}

/** Scenario (b): multi-file batch where one candidate is stale. */
function runBatchChecks(h: VerifyHarness, dir: string): void {
  console.log("\nScenario (b) — multi-file batch with one stale candidate:");
  const fileA = join(dir, "batch-a.sql");
  const fileB = join(dir, "batch-b.sql");
  writeFileSync(fileA, "A CONTENT", "utf8");
  writeFileSync(fileB, "B CONTENT", "utf8");
  const candidates = [
    makeCandidate(fileA, "batch-a.sql", "A CONTENT"),
    makeCandidate(fileB, "batch-b.sql", "B CONTENT"),
  ];

  h.check("clean batch yields no conflict", detectBatchConflict(candidates).kind === "none");
  h.check("clean batch passes validateCandidateBatch", validateCandidateBatch(candidates).ok);

  writeFileSync(fileB, "B CHANGED ON DISK", "utf8");
  const conflict = detectBatchConflict(candidates);
  h.check("stale batch member detected as fileChanged", conflict.kind === "fileChanged");
  h.check(
    "batch conflict names the stale member",
    conflict.kind === "fileChanged" && conflict.sourceFile === "batch-b.sql",
  );
  h.check(
    "stale batch fails validateCandidateBatch (fail-closed)",
    validateCandidateBatch(candidates).ok === false,
  );
}

/** Every conflict kind has a clear, non-empty message; none is empty. */
function runMessageChecks(h: VerifyHarness): void {
  console.log("\nConflict messages:");
  h.check("no-conflict message is empty", conflictMessage({ kind: "none" }) === "");
  h.check("hasConflict false for none", hasConflict({ kind: "none" }) === false);

  const kinds = [
    "fileChanged",
    "fileMissing",
    "fileAlreadyExists",
    "fileAlreadyDeleted",
  ] as const;
  for (const kind of kinds) {
    const conflict = { kind, sourceFile: "x.sql" } as const;
    h.check(
      `${kind} produces a recompute-oriented message`,
      conflictMessage(conflict).includes("x.sql") &&
        conflictMessage(conflict).toLowerCase().includes("recompute"),
    );
    h.check(`${kind} reports hasConflict`, hasConflict(conflict));
  }
}
