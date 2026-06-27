/**
 * P0-14 — file-role detection and coverage triage helpers.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifySqlFileRole, isTableSqlFile } from "../sqlFileRole.ts";
import { buildProjectModel } from "../project.ts";
import { VerifyHarness } from "./harness.ts";
import { FIXTURES, REAL_PROJECT, SAMPLE_PROJECT } from "./paths.ts";
import { existsSync } from "node:fs";

export function runVerifyP014(): void {
  const h = new VerifyHarness();
  console.log("SqlprojErdForge — P0-14 file-role verification (headless)\n");

  const procFixture = join(FIXTURES, "edge", "dbo.SampleProc.sql");
  const procSrc = readFileSync(procFixture, "utf8");
  h.check("SampleProc classified non_table", classifySqlFileRole(procSrc) === "non_table");
  h.check("nested #temp CREATE does not classify as table", !isTableSqlFile(procSrc));

  const tierMatrix = readFileSync(join(FIXTURES, "edge", "dbo.TierMatrix.sql"), "utf8");
  h.check("commented-out TierMatrix is non_table", classifySqlFileRole(tierMatrix) === "non_table");

  const headerStatus = readFileSync(
    join(FIXTURES, "purple", "dbo.pr_procurement_header_status.sql"),
    "utf8",
  );
  h.check("table fixture classified as table", classifySqlFileRole(headerStatus) === "table");

  const { model, skipped } = buildProjectModel(SAMPLE_PROJECT);
  h.check("SampleProc skipped without parse error", skipped.some((s) => /SampleProc/i.test(s.include)));
  const procErrors = model.diagnostics.filter(
    (d) => d.severity === "error" && /SampleProc/i.test(d.file),
  );
  h.check("SampleProc produces no diagnostics", procErrors.length === 0);

  if (existsSync(REAL_PROJECT)) {
    const real = buildProjectModel(REAL_PROJECT);
    const errors = real.model.diagnostics.filter((d) => d.severity === "error");
    h.check("real project has zero parse errors after file-role filter", errors.length === 0);
    h.check("real project still parses 96 tables", real.model.tables.size === 96);
    console.log(
      `  real project: ${real.model.tables.size} tables, ${real.model.diagnostics.length} diagnostics (${errors.length} errors)`,
    );
  } else {
    console.log(`  Real project not found at ${REAL_PROJECT} — skipping scale checks.`);
  }

  h.exitWithSummary("ALL P0-14 CHECKS PASSED", "{n} P0-14 CHECK(S) FAILED");
}

/** Summarize warning messages for triage output (used by spike:real). */
export function summarizeWarnings(
  warnings: { message: string }[],
  limit = 8,
): [string, number][] {
  const byMsg = new Map<string, number>();
  for (const d of warnings) {
    const key = d.message.replace(/'[^']*'/g, "'…'");
    byMsg.set(key, (byMsg.get(key) ?? 0) + 1);
  }
  return [...byMsg.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}
