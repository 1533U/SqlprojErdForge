/**
 * Real-project discovery smoke test (P0-13, read-only).
 */

import { readFileSync } from "node:fs";
import { buildEdges } from "../erd.ts";
import { buildProjectModel, discover } from "../project.ts";
import { classifySqlFileRole } from "../sqlFileRole.ts";
import { REAL_PROJECT } from "./paths.ts";
import { summarizeWarnings } from "./p014.ts";

export function runReal(): void {
  console.log("SqlprojErdForge — Phase 0 discovery smoke test (P0-13, read-only)\n");
  let disc;
  try {
    disc = discover(REAL_PROJECT);
  } catch {
    console.log(`  Real project not found at ${REAL_PROJECT} — skipping smoke test.`);
    return;
  }
  const { model, skipped } = buildProjectModel(REAL_PROJECT);
  const edges = buildEdges(model);
  const sqlItems = disc.buildItems.filter((b) => b.isSql);
  const errors = model.diagnostics.filter((d) => d.severity === "error");
  const warnings = model.diagnostics.filter((d) => d.severity === "warning");

  console.log(`  build items:        ${disc.buildItems.length} (sql: ${sqlItems.length})`);
  console.log(`  parsed tables:      ${model.tables.size}`);
  console.log(`  skipped (no table): ${skipped.length}`);
  console.log(`  edges (FK-only):    ${edges.length}`);
  console.log(
    `  diagnostics:        ${model.diagnostics.length} (errors: ${errors.length}, warnings: ${warnings.length})`,
  );

  const errByMsg = new Map<string, number>();
  for (const d of errors) {
    const key = d.message.replace(/'[^']*'/g, "'…'");
    errByMsg.set(key, (errByMsg.get(key) ?? 0) + 1);
  }
  if (errByMsg.size) {
    console.log("\n  Top error categories (construct coverage gaps to triage):");
    for (const [msg, count] of [...errByMsg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      console.log(`    ${String(count).padStart(4)}  ${msg}`);
    }
  }

  const warnByMsg = summarizeWarnings(warnings);
  if (warnByMsg.length) {
    console.log("\n  Top warning categories:");
    for (const [msg, count] of warnByMsg) {
      console.log(`    ${String(count).padStart(4)}  ${msg}`);
    }
  }

  const procPaths = sqlItems.filter((b) => classifySqlFileRole(readFileSync(b.absPath, "utf8")) === "non_table");
  console.log(`\n  non-table sql build items (procs/views/…): ${procPaths.length}`);
  console.log("\n  Smoke test complete (no files were modified).");
}
