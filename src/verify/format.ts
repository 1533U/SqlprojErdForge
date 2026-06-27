/**
 * P4-1 — canonical format conformance checks.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkTableFile,
  checkTableSqlConformance,
  formatCheckFailed,
  type FormatCheckResult,
} from "../formatCheck.ts";
import { emitTable } from "../emitter.ts";
import { buildProjectModel } from "../project.ts";
import { VerifyHarness } from "./harness.ts";
import { listChangedSqlFiles, resolveFormatCheckBase } from "./gitSqlFiles.ts";
import { FIXTURES, SAMPLE_PROJECT } from "./paths.ts";

function printResult(result: FormatCheckResult): void {
  switch (result.status) {
    case "ok":
      console.log(`  [PASS] ${result.file}`);
      break;
    case "skipped":
      console.log(`  [SKIP] ${result.file} — ${result.detail ?? "skipped"}`);
      break;
    case "non_canonical":
      console.log(`  [FAIL] ${result.file} — ${result.detail ?? "not canonical"}`);
      break;
    case "parse_error":
      console.log(`  [FAIL] ${result.file} — parse error: ${result.detail ?? "unknown"}`);
      break;
    default: {
      const _exhaustive: never = result.status;
      console.log(`  [FAIL] ${result.file} — unknown status ${_exhaustive}`);
    }
  }
}

/** Headless checks that the format-check machinery behaves correctly. */
export function runVerifyFormat(): void {
  const h = new VerifyHarness();
  console.log("SqlprojErdForge — format check verification (headless)\n");

  const { model } = buildProjectModel(SAMPLE_PROJECT);
  const sample = model.tables.get("dbo.pr_procurement_header_status");
  h.check("fixture table available for synthetic canonical check", !!sample);
  if (sample) {
    const canonical = emitTable(sample);
    const synthetic = checkTableSqlConformance(canonical, "synthetic-canonical.sql");
    h.check("emitter output passes conformance", synthetic.status === "ok", synthetic.detail);
  }

  const legacyPath = join(FIXTURES, "purple", "dbo.pr_procurement_header_status.sql");
  const legacy = checkTableFile(legacyPath);
  h.check(
    "legacy non-canonical fixture is flagged",
    legacy.status === "non_canonical",
    legacy.status,
  );

  const tierMatrix = checkTableFile(join(FIXTURES, "edge", "dbo.TierMatrix.sql"));
  h.check(
    "commented-out table file is skipped (C9)",
    tierMatrix.status === "skipped",
    tierMatrix.status,
  );

  const commentedSrc = readFileSync(tierMatrix.file, "utf8");
  h.check(
    "checkTableSqlConformance matches checkTableFile for TierMatrix",
    checkTableSqlConformance(commentedSrc, tierMatrix.file).status === "skipped",
  );

  h.exitWithSummary("ALL FORMAT CHECKS PASSED", "{n} FORMAT CHECK(S) FAILED");
}

export interface RunFormatCheckOptions {
  /** Git merge base for changed-file scope (ADR-0010). */
  base?: string;
  /** Explicit file paths (absolute or repo-relative); overrides git discovery. */
  files?: string[];
}

/**
 * Gate: changed (or explicit) `.sql` table files must match emit(parse) on disk.
 * Exits 0 when there is nothing to check or all checked files pass.
 */
export function runFormatCheck(options: RunFormatCheckOptions = {}): void {
  console.log("SqlprojErdForge — canonical format check (P4-1)\n");

  const files =
    options.files && options.files.length > 0
      ? options.files
      : listChangedSqlFiles(resolveFormatCheckBase(options.base));

  if (files.length === 0) {
    console.log("No .sql files to check (none changed vs base, or not a git repo).\n");
    console.log("ALL FORMAT CHECKS PASSED (nothing to verify)");
    process.exit(0);
  }

  const base = options.files?.length ? "(explicit files)" : resolveFormatCheckBase(options.base);
  console.log(`Scope: ${files.length} file(s) vs ${base}\n`);

  let failures = 0;
  for (const file of files) {
    const result = checkTableFile(file);
    printResult(result);
    if (formatCheckFailed(result)) failures++;
  }

  console.log(
    `\n${failures === 0 ? "ALL FORMAT CHECKS PASSED" : `${failures} FORMAT CHECK(S) FAILED`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}
