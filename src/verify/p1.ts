/**
 * Phase 1 exit-criteria verification (headless).
 */

import { performance } from "node:perf_hooks";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildEdges } from "../erd.ts";
import { buildGraphPayload } from "../graph.ts";
import { applyLayoutUpdate, readLayout, writeLayout } from "../layout.ts";
import { buildProjectModel } from "../project.ts";
import { VerifyHarness } from "./harness.ts";
import { FIXTURES, REAL_PROJECT, SAMPLE_PROJECT } from "./paths.ts";

export async function runVerifyP1(): Promise<void> {
  const h = new VerifyHarness();
  console.log("SqlprojErdForge — Phase 1 exit-criteria verification (headless)\n");

  console.log("Fixtures (SampleErd.sqlproj):");
  const fixtureLayout = readLayout(SAMPLE_PROJECT);
  const fixturePayload = await buildGraphPayload(
    buildProjectModel(SAMPLE_PROJECT).model,
    fixtureLayout,
  );
  h.check("11 tables in fixture project", fixturePayload.tables.length === 11);
  h.check("9 in-project FK edges (10 dangling omitted)", fixturePayload.edges.length === 9);
  h.check(
    "committed layout sidecar covers all fixture tables",
    fixturePayload.tables.every((t) => fixtureLayout.tables[t.key] != null),
  );

  const customerTable = fixturePayload.tables.find((t) => t.key === "dbo.Customer");
  const idCol = customerTable?.columns.find((c) => c.name === "Id");
  const nameCol = customerTable?.columns.find((c) => c.name === "Name");
  const emailCol = customerTable?.columns.find((c) => c.name === "Email");
  h.check("Customer Id trailing comment on graph", idCol?.description === "surrogate key", idCol?.description);
  h.check(
    "Customer Email trailing comment on graph",
    emailCol?.description === "nullable until verified",
    emailCol?.description,
  );
  h.check(
    "Customer Name has no trailing comment (leading-only deferred)",
    nameCol?.description === undefined,
    nameCol?.description,
  );

  const layoutBackup = JSON.stringify(fixtureLayout);
  const testLayout = applyLayoutUpdate(fixtureLayout, "dbo.pr_supplier", 4242, 2424);
  writeLayout(SAMPLE_PROJECT, testLayout);
  const reread = readLayout(SAMPLE_PROJECT);
  h.check(
    "layout sidecar write/read roundtrip",
    reread.tables["dbo.pr_supplier"]?.x === 4242 && reread.tables["dbo.pr_supplier"]?.y === 2424,
  );
  writeLayout(SAMPLE_PROJECT, JSON.parse(layoutBackup) as ReturnType<typeof readLayout>);

  const refreshPayload = await buildGraphPayload(
    buildProjectModel(SAMPLE_PROJECT).model,
    readLayout(SAMPLE_PROJECT),
  );
  const savedPos = refreshPayload.layout.tables["dbo.pr_supplier"];
  h.check(
    "saved layout survives re-parse refresh",
    savedPos?.x === 2283 && savedPos?.y === 75,
    JSON.stringify(savedPos),
  );

  const itemPath = join(FIXTURES, "purple", "dbo.pr_procurement_item.sql");
  const itemSrc = readFileSync(itemPath, "utf8");
  const edited = itemSrc.replace(
    ",[procurement_header_id]\t\t\t\tINT\t\t\t\tNOT NULL",
    ",[procurement_header_id]\t\t\t\tINT\t\t\t\tNOT NULL\n\t,[test_column_erdforge]\t\t\t\tINT\t\t\t\tNULL",
  );
  writeFileSync(itemPath, edited);
  const t0 = performance.now();
  const editedModel = buildProjectModel(SAMPLE_PROJECT).model;
  await buildGraphPayload(editedModel, readLayout(SAMPLE_PROJECT));
  const refreshMs = performance.now() - t0;
  writeFileSync(itemPath, itemSrc);
  const editedTable = editedModel.tables.get("dbo.pr_procurement_item");
  h.check(
    "file edit adds a column to the model",
    editedTable?.members.some((m) => m.kind === "column" && m.name === "test_column_erdforge") ===
      true,
  );
  h.check("refresh pipeline under 1 s", refreshMs < 1000, `${refreshMs.toFixed(0)} ms`);
  console.log(`  refresh pipeline: ${refreshMs.toFixed(0)} ms (+ 500 ms debounce in extension)`);

  console.log("\nReal project (OSConnectWeylandtsDB):");
  if (!existsSync(REAL_PROJECT)) {
    console.log(`  Real project not found at ${REAL_PROJECT} — skipping scale checks.`);
  } else {
    const t1 = performance.now();
    const { model } = buildProjectModel(REAL_PROJECT);
    const realPayload = await buildGraphPayload(model, readLayout(REAL_PROJECT));
    const totalMs = performance.now() - t1;
    const rawEdges = buildEdges(model).length;
    const positioned = Object.keys(realPayload.layout.tables).length;

    h.check("96 tables parsed", realPayload.tables.length === 96);
    h.check("105 in-project FK edges (20 dangling omitted)", realPayload.edges.length === 105);
    h.check("125 raw FK edges before filtering", rawEdges === 125);
    h.check("ELK positions every table", positioned === realPayload.tables.length);
    h.check("scale build under 3 s", totalMs < 3000, `${totalMs.toFixed(0)} ms`);
    h.check(
      "Problems-scale diagnostics present (warnings only after P0-14a)",
      model.diagnostics.length >= 590 &&
        model.diagnostics.filter((d) => d.severity === "error").length === 0,
    );
    console.log(
      `  ${realPayload.tables.length} tables, ${realPayload.edges.length} edges, ${model.diagnostics.length} diagnostics in ${totalMs.toFixed(0)} ms`,
    );
  }

  h.exitWithSummary("ALL P1 CHECKS PASSED", "{n} P1 CHECK(S) FAILED");
}
