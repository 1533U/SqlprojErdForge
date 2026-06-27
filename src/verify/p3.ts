/**
 * Phase 3 edit verification (headless).
 */

import { buildProjectModel } from "../project.ts";
import { VerifyHarness } from "./harness.ts";
import { SAMPLE_PROJECT } from "./paths.ts";
import { runAddColumnChecks } from "./p3/addColumn.ts";
import { runAddFkChecks } from "./p3/addForeignKey.ts";
import { runRemoveColumnChecks } from "./p3/removeColumn.ts";
import { runChangeColumnChecks } from "./p3/changeColumn.ts";
import { runAddTableChecks } from "./p3/addTable.ts";
import { runDropTableChecks } from "./p3/dropTable.ts";
import { runRenameColumnChecks } from "./p3/renameColumn.ts";
import { runRenameTableChecks } from "./p3/renameTable.ts";
import { runBatchApplyChecks } from "./p3/batchApply.ts";

export function runVerifyP3(): void {
  const h = new VerifyHarness();
  console.log("SqlprojErdForge — Phase 3 edit verification (headless)\n");

  const { model } = buildProjectModel(SAMPLE_PROJECT);

  console.log("Add foreign key:");
  runAddFkChecks(h, model);

  console.log("\nAdd column:");
  runAddColumnChecks(h, model);

  console.log("\nRemove column:");
  runRemoveColumnChecks(h, model);

  console.log("\nRename column:");
  runRenameColumnChecks(h, model);

  console.log("\nChange column:");
  runChangeColumnChecks(h, model);

  console.log("\nAdd table:");
  runAddTableChecks(h, model);

  console.log("\nDrop table:");
  runDropTableChecks(h, model);

  console.log("\nRename table:");
  runRenameTableChecks(h, model);

  console.log("\nBatch apply (P4-3):");
  runBatchApplyChecks(h, model);

  h.exitWithSummary("ALL P3 CHECKS PASSED", "{n} P3 CHECK(S) FAILED");
}
