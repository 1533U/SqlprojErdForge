/**
 * P0-14 — file-role detection and coverage triage helpers.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifySqlFileRole, isTableSqlFile } from "../sqlFileRole.ts";
import { buildProjectModel } from "../project.ts";
import { parseTable } from "../parser.ts";
import { emitTable } from "../emitter.ts";
import { findColumn } from "../edits/memberChecks.ts";
import type { Table } from "../model.ts";
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

  console.log("\nP0-14b — column-modifier coverage (ADR-0015):");
  const cmSrc = readFileSync(join(FIXTURES, "edge", "dbo.ColumnModifiers.sql"), "utf8");
  const cm = parseTable(cmSrc, "edge/dbo.ColumnModifiers.sql");
  const modWarnings = cm.diagnostics.filter((d) => /Unsupported column modifier/.test(d.message));
  h.check("ColumnModifiers fixture parses to a table", !!cm.table);
  h.check("ColumnModifiers fixture has zero unsupported-modifier warnings", modWarnings.length === 0);
  if (cm.table) {
    const t = cm.table;
    const imageId = findColumn(t, "image_id");
    h.check("inline PRIMARY KEY modeled on image_id", imageId?.primaryKeyInline === true);
    const flag = findColumn(t, "flag");
    h.check("inline CHECK modeled on flag", (flag?.checks?.length ?? 0) === 1);
    const basis = findColumn(t, "basis");
    h.check("multi-clause inline CHECK modeled on basis", (basis?.checks?.length ?? 0) === 1);
    const rowGuid = findColumn(t, "row_guid");
    h.check("ROWGUIDCOL modeled on row_guid", rowGuid?.rowguidcol === true);
    h.check("inline UNIQUE modeled on row_guid", rowGuid?.uniqueInline === true);
    h.check("DEFAULT NEWSEQUENTIALID() captured on row_guid", rowGuid?.default === "NEWSEQUENTIALID()");
    const binaryData = findColumn(t, "binary_data");
    h.check("FILESTREAM modeled on binary_data", binaryData?.filestream === true);
    const fileSize = findColumn(t, "file_size");
    h.check("computed expression modeled on file_size", !!fileSize?.computed);
    h.check("PERSISTED modeled on file_size", fileSize?.persisted === true);
    const resourceKey = findColumn(t, "resource_key");
    h.check("non-persisted computed modeled on resource_key", !!resourceKey?.computed && resourceKey?.persisted !== true);

    // Round-trip safety: canonical fixed point after one normalization pass.
    const e1 = emitTable(t);
    const second = parseTable(e1, "edge/dbo.ColumnModifiers.sql");
    const e2 = second.table ? emitTable(second.table as Table) : "";
    h.check("ColumnModifiers reaches a canonical fixed point", !!second.table && e1 === e2);
    const reModWarnings = (second.diagnostics ?? []).filter((d) => /Unsupported column modifier/.test(d.message));
    h.check("re-parse of canonical output has zero modifier warnings", reModWarnings.length === 0);
  }

  if (existsSync(REAL_PROJECT)) {
    const real = buildProjectModel(REAL_PROJECT);
    const errors = real.model.diagnostics.filter((d) => d.severity === "error");
    const warnings = real.model.diagnostics.filter((d) => d.severity === "warning");
    const realModWarnings = warnings.filter((d) => /Unsupported column modifier/.test(d.message));
    h.check("real project has zero parse errors after file-role filter", errors.length === 0);
    h.check("real project still parses 96 tables", real.model.tables.size === 96);
    // P0-14b target: 591 modifier warnings eliminated; only ADR-0012 post-GO warnings remain.
    h.check("real project has zero unsupported-modifier warnings (was 591)", realModWarnings.length === 0);
    h.check("real project total diagnostics reduced to 6 post-GO warnings (was 597)", real.model.diagnostics.length === 6);
    // Every real table must round-trip to a canonical fixed point.
    let fpFailures = 0;
    for (const table of real.model.tables.values()) {
      const e1 = emitTable(table);
      const reparsed = parseTable(e1, table.sourceFile).table;
      if (!reparsed || emitTable(reparsed) !== e1) fpFailures++;
    }
    h.check("all 96 real tables reach a canonical fixed point", fpFailures === 0);
    console.log(
      `  real project: ${real.model.tables.size} tables, ${real.model.diagnostics.length} diagnostics (${errors.length} errors, ${realModWarnings.length} modifier warnings)`,
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
