/**
 * Phase 0 spike harness (P0-5).
 *
 * Default run (fixtures): load test/fixtures/SampleErd.sqlproj → discover → parse → emit →
 * re-parse, and assert the exit criteria from docs/07-roadmap.md:
 *  - stable fixed point after one normalization pass: emit(parse(emit(x))) === emit(parse(x))
 *  - all four comment slots + the rule-5 footer fallback survive (docs/04)
 *  - commented-out schema is ignored (C9)
 *  - ERD edges come only from declared FKs (C10)
 *
 * `--real` runs the discovery smoke test (P0-13) against the real OSConnectWeylandtsDB
 * project (read-only; nothing is written).
 *
 * `--verify-p1` runs headless Phase 1 exit-criteria checks: graph build + ELK layout at
 * scale, layout sidecar roundtrip, and re-parse timing after a fixture edit.
 */

import { performance } from "node:perf_hooks";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Table, Member } from "./model.ts";
import { parseTable } from "./parser.ts";
import { emitTable } from "./emitter.ts";
import { buildProjectModel, discover } from "./project.ts";
import { buildEdges } from "./erd.ts";
import { applyLayoutUpdate, buildGraphPayload } from "./graph.ts";
import { readLayout, writeLayout } from "./layout.ts";
import { applyAddColumnToModel, prepareAddColumn } from "./edits/addColumn.ts";
import { applyAddForeignKeyToModel, prepareAddForeignKey, suggestForeignKeyName } from "./edits/addForeignKey.ts";
import { applyRemoveColumnToModel, prepareRemoveColumn } from "./edits/removeColumn.ts";
import { applyRenameColumnToModel, prepareRenameColumn } from "./edits/renameColumn.ts";
import { findColumn } from "./edits/memberChecks.ts";
import type { EditValidationResult, FileEditCandidate } from "./edits/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const FIXTURES = join(REPO, "test", "fixtures");
const SAMPLE_PROJECT = join(FIXTURES, "SampleErd.sqlproj");
const REAL_PROJECT =
  "/home/gerhard/Projects/Purple/OSConnectWeylandtsDB-master/OSConnectWeylandtsDB.sqlproj";

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  const mark = ok ? "PASS" : "FAIL";
  if (!ok) failures++;
  console.log(`  [${mark}] ${label}${detail && !ok ? ` — ${detail}` : ""}`);
}

function checkPrepareOk(label: string, result: EditValidationResult): result is Extract<EditValidationResult, { ok: true }> {
  const ok = result.ok === true && result.candidates.length > 0;
  check(label, ok);
  return ok;
}

function primaryCandidate(result: Extract<EditValidationResult, { ok: true }>): FileEditCandidate {
  return result.candidates[0]!;
}

function checkPrepareRejected(label: string, result: EditValidationResult): void {
  check(label, result.ok === false, result.ok ? undefined : result.message);
}

function memberNames(table: Table): string[] {
  return table.members.map((m: Member) => {
    switch (m.kind) {
      case "column":
        return m.name;
      case "constraint":
        return m.name;
      case "period":
        return "PERIOD";
      default:
        return "?";
    }
  });
}

function runFixtures(): void {
  console.log("SqlprojErdForge — Phase 0 spike (fixtures)\n");

  // ---- Discovery (P0-12) ----
  console.log("Discovery from SampleErd.sqlproj:");
  const disc = discover(SAMPLE_PROJECT);
  const sqlItems = disc.buildItems.filter((b) => b.isSql);
  const nonSql = disc.buildItems.filter((b) => !b.isSql);
  console.log(`  build items: ${disc.buildItems.length} (sql: ${sqlItems.length}, non-sql: ${nonSql.length}); <None>: ${disc.noneItems.length}`);
  check(
    "backslash include paths are normalized to existing files",
    sqlItems.every((b) => {
      try {
        readFileSync(b.absPath);
        return true;
      } catch {
        return false;
      }
    }),
  );

  const { model, skipped } = buildProjectModel(SAMPLE_PROJECT);
  console.log(`  parsed tables: ${model.tables.size}; skipped (non-table / commented-out): ${skipped.length}`);
  console.log(`  diagnostics: ${model.diagnostics.length}`);
  for (const d of model.diagnostics) {
    console.log(`    - ${d.severity} ${d.file}:${d.line} ${d.message}`);
  }

  // ---- C9: commented-out schema is ignored ----
  console.log("\nC9 — commented-out schema is ignored:");
  check("dbo.TierMatrix yields no table", !model.tables.has("dbo.TierMatrix"));
  const item = model.tables.get("dbo.pr_procurement_item");
  check("pr_procurement_item parsed", !!item);
  if (item) {
    check(
      "commented-out column erp_po_master_plus_loaded is not a column",
      !findColumn(item, "erp_po_master_plus_loaded"),
    );
    const noTierMatrixDiag = !model.diagnostics.some((d) => /TierMatrix/i.test(d.file) && d.severity === "error");
    check("TierMatrix produced no diagnostic", noTierMatrixDiag);
  }

  // ---- C10: edges only from declared FKs ----
  console.log("\nC10 — ERD edges only from declared FOREIGN KEYs:");
  const edges = buildEdges(model);
  console.log(`  total edges: ${edges.length}`);
  const header = model.tables.get("dbo.pr_procurement_header");
  if (header) {
    const targets = edges.filter((e) => e.from === "dbo.pr_procurement_header").map((e) => e.to).sort();
    const expected = [
      "dbo.pr_buying_season",
      "dbo.pr_port",
      "dbo.pr_port",
      "dbo.pr_procurement_header_status",
      "dbo.pr_shipping_type",
      "dbo.pr_supplier",
      "dbo.pr_syspro_buyer",
    ].sort();
    check(
      "pr_procurement_header has exactly its 7 declared FK edges",
      JSON.stringify(targets) === JSON.stringify(expected),
      JSON.stringify(targets),
    );
  }
  if (item) {
    const itemTargets = edges.filter((e) => e.from === "dbo.pr_procurement_item").map((e) => e.to);
    check(
      "commented-out FKs (pr_color / pr_finish) produce no edges",
      !itemTargets.includes("dbo.pr_color") && !itemTargets.includes("dbo.pr_finish"),
    );
    check("unbracketed REFERENCES pr_tariff_code yields an edge", itemTargets.includes("dbo.pr_tariff_code"));
  }
  const invBuyer = model.tables.get("dbo.InvBuyer");
  check("dbo.InvBuyer parsed", !!invBuyer);
  if (invBuyer) {
    check("InvBuyer (no FKs) has no outgoing edges", !edges.some((e) => e.from === "dbo.InvBuyer"));
    check("InvBuyer is classified read-only (ADR-0011)", invBuyer.readOnly === true);
  }

  // ---- Comment model: all four slots + rule-5 fallback (P0-6) ----
  console.log("\nComment model — four slots + footer fallback:");
  const csSrc = readFileSync(join(FIXTURES, "comments", "dbo.CommentSlots.sql"), "utf8");
  const cs = parseTable(csSrc, "dbo.CommentSlots.sql").table;
  check("CommentSlots parsed", !!cs);
  if (cs) {
    check("header slot", JSON.stringify(cs.headerComments) === JSON.stringify(["Customer master record"]), JSON.stringify(cs.headerComments));
    const id = findColumn(cs, "Id");
    const name = findColumn(cs, "Name");
    const email = findColumn(cs, "Email");
    check("trailing slot (Id)", id?.trailingComment === "surrogate key", id?.trailingComment);
    check("leading slot (Name)", JSON.stringify(name?.leadingComments) === JSON.stringify(["display name shown in the UI"]), JSON.stringify(name?.leadingComments));
    check("trailing slot (Email)", email?.trailingComment === "nullable until verified", email?.trailingComment);
    check(
      "footer slot incl. rule-5 fallback",
      JSON.stringify(cs.footerComments) === JSON.stringify(["audit columns still TODO", "Owned by the Accounts team"]),
      JSON.stringify(cs.footerComments),
    );
  }

  // ---- Idempotent fixed point (P0-6, exit criterion) ----
  console.log("\nStable fixed point — emit(parse(emit(x))) === emit(parse(x)):");
  const roundTripFiles = sqlItems.map((b) => b.absPath);
  let normalized = 0;
  let roundTripped = 0;
  for (const file of roundTripFiles) {
    const src = readFileSync(file, "utf8");
    const first = parseTable(src, file);
    if (!first.table) continue; // C9 file (e.g. TierMatrix): nothing to round-trip.
    roundTripped++;
    const e1 = emitTable(first.table);
    const second = parseTable(e1, file);
    const ok2 = !!second.table;
    const e2 = ok2 ? emitTable(second.table as Table) : "";
    check(`fixed point: ${first.table.sourceFile}`, ok2 && e1 === e2);
    if (e1 !== src) normalized++;
  }
  console.log(`  (${normalized}/${roundTripped} files required a one-time normalization pass; all reach a fixed point thereafter)`);

  // ---- Show one normalization diff sample so it can be eyeballed as acceptable ----
  console.log("\nSample canonical output (dbo.pr_procurement_header_status):");
  const sample = model.tables.get("dbo.pr_procurement_header_status");
  if (sample) console.log(indent(emitTable(sample)));

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

function runReal(): void {
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
  console.log(`  diagnostics:        ${model.diagnostics.length} (errors: ${errors.length}, warnings: ${warnings.length})`);

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
  console.log("\n  Smoke test complete (no files were modified).");
}

async function runVerifyP1(): Promise<void> {
  console.log("SqlprojErdForge — Phase 1 exit-criteria verification (headless)\n");

  // ---- Fixture graph + layout sidecar ----
  console.log("Fixtures (SampleErd.sqlproj):");
  const fixtureLayout = readLayout(SAMPLE_PROJECT);
  const fixturePayload = await buildGraphPayload(
    buildProjectModel(SAMPLE_PROJECT).model,
    fixtureLayout,
  );
  check("11 tables in fixture project", fixturePayload.tables.length === 11);
  check("9 in-project FK edges (10 dangling omitted)", fixturePayload.edges.length === 9);
  check(
    "committed layout sidecar covers all fixture tables",
    fixturePayload.tables.every((t) => fixtureLayout.tables[t.key] != null),
  );

  const customerTable = fixturePayload.tables.find((t) => t.key === "dbo.Customer");
  const idCol = customerTable?.columns.find((c) => c.name === "Id");
  const nameCol = customerTable?.columns.find((c) => c.name === "Name");
  const emailCol = customerTable?.columns.find((c) => c.name === "Email");
  check("Customer Id trailing comment on graph", idCol?.description === "surrogate key", idCol?.description);
  check(
    "Customer Email trailing comment on graph",
    emailCol?.description === "nullable until verified",
    emailCol?.description,
  );
  check(
    "Customer Name has no trailing comment (leading-only deferred)",
    nameCol?.description === undefined,
    nameCol?.description,
  );

  const layoutBackup = JSON.stringify(fixtureLayout);
  const testLayout = applyLayoutUpdate(fixtureLayout, "dbo.pr_supplier", 4242, 2424);
  writeLayout(SAMPLE_PROJECT, testLayout);
  const reread = readLayout(SAMPLE_PROJECT);
  check(
    "layout sidecar write/read roundtrip",
    reread.tables["dbo.pr_supplier"]?.x === 4242 && reread.tables["dbo.pr_supplier"]?.y === 2424,
  );
  writeLayout(SAMPLE_PROJECT, JSON.parse(layoutBackup) as ReturnType<typeof readLayout>);

  const refreshPayload = await buildGraphPayload(
    buildProjectModel(SAMPLE_PROJECT).model,
    readLayout(SAMPLE_PROJECT),
  );
  const savedPos = refreshPayload.layout.tables["dbo.pr_supplier"];
  check(
    "saved layout survives re-parse refresh",
    savedPos?.x === 2283 && savedPos?.y === 75,
    JSON.stringify(savedPos),
  );

  // ---- Live refresh pipeline (parse + graph; extension adds 500 ms debounce) ----
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
  check(
    "file edit adds a column to the model",
    editedTable?.members.some((m) => m.kind === "column" && m.name === "test_column_erdforge") === true,
  );
  check("refresh pipeline under 1 s", refreshMs < 1000, `${refreshMs.toFixed(0)} ms`);
  console.log(`  refresh pipeline: ${refreshMs.toFixed(0)} ms (+ 500 ms debounce in extension)`);

  // ---- Real project at scale ----
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

    check("96 tables parsed", realPayload.tables.length === 96);
    check("105 in-project FK edges (20 dangling omitted)", realPayload.edges.length === 105);
    check("125 raw FK edges before filtering", rawEdges === 125);
    check("ELK positions every table", positioned === realPayload.tables.length);
    check("scale build under 3 s", totalMs < 3000, `${totalMs.toFixed(0)} ms`);
    check(
      "Problems-scale diagnostics present",
      model.diagnostics.length >= 600 &&
        model.diagnostics.filter((d) => d.severity === "error").length === 9,
    );
    console.log(
      `  ${realPayload.tables.length} tables, ${realPayload.edges.length} edges, ${model.diagnostics.length} diagnostics in ${totalMs.toFixed(0)} ms`,
    );
  }

  console.log(`\n${failures === 0 ? "ALL P1 CHECKS PASSED" : `${failures} P1 CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

function runVerifyP3(): void {
  console.log("SqlprojErdForge — Phase 3 edit verification (headless)\n");

  const { model } = buildProjectModel(SAMPLE_PROJECT);

  console.log("Add foreign key:");
  runAddFkChecks(model);

  console.log("\nAdd column:");
  runAddColumnChecks(model);

  console.log("\nRemove column:");
  runRemoveColumnChecks(model);

  console.log("\nRename column:");
  runRenameColumnChecks(model);

  console.log(`\n${failures === 0 ? "ALL P3 CHECKS PASSED" : `${failures} P3 CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

function runAddFkChecks(model: ReturnType<typeof buildProjectModel>["model"]): void {
  const params = {
    fromTableKey: "dbo.pr_buying_season",
    fromColumn: "last_modified_user_id",
    toTableKey: "dbo.pr_port",
    toColumn: "port_id",
    constraintName: "FK_test_erdforge_buying_season_port",
  };

  check(
    "suggested FK name",
    suggestForeignKeyName(params.fromTableKey, params.toTableKey) === "FK_pr_buying_season_pr_port",
  );

  const prepared = prepareAddForeignKey(model, params);
  if (checkPrepareOk("add FK candidate builds", prepared)) {
    const candidate = primaryCandidate(prepared);
    check(
      "candidate emits named FOREIGN KEY",
      candidate.candidateContent.includes(
        `CONSTRAINT ${params.constraintName} FOREIGN KEY (last_modified_user_id) REFERENCES dbo.pr_port (port_id)`,
      ),
    );
    check(
      "candidate differs from on-disk source",
      candidate.candidateContent !== candidate.originalContent,
    );
  }

  checkPrepareRejected(
    "duplicate FK rejected",
    prepareAddForeignKey(applyAddForeignKeyToModel(model, params), params),
  );

  checkPrepareRejected(
    "read-only source rejected",
    prepareAddForeignKey(model, {
      fromTableKey: "dbo.InvBuyer",
      fromColumn: "Buyer",
      toTableKey: "dbo.pr_port",
      toColumn: "port_id",
      constraintName: "FK_test_readonly",
    }),
  );

  checkPrepareRejected(
    "missing source column rejected",
    prepareAddForeignKey(model, {
      ...params,
      fromColumn: "not_a_column",
    }),
  );
}

function runAddColumnChecks(model: ReturnType<typeof buildProjectModel>["model"]): void {
  const params = {
    tableKey: "dbo.pr_buying_season",
    columnName: "test_column_erdforge",
    dataType: "INT",
    nullable: true,
    trailingComment: "added by verify:p3",
  };

  const prepared = prepareAddColumn(model, params);
  if (checkPrepareOk("add column candidate builds", prepared)) {
    const candidate = primaryCandidate(prepared);
    check(
      "candidate emits new column before constraints",
      candidate.candidateContent.includes(
        "test_column_erdforge INT NULL, -- added by verify:p3",
      ),
    );
    check(
      "candidate differs from on-disk source",
      candidate.candidateContent !== candidate.originalContent,
    );

    const mutated = applyAddColumnToModel(model, params);
    const table = mutated.tables.get(params.tableKey);
    const names = table ? memberNames(table) : [];
    check(
      "new column inserted before PERIOD/PK",
      names.indexOf("test_column_erdforge") < names.indexOf("PERIOD"),
      JSON.stringify(names),
    );
  }

  checkPrepareRejected(
    "duplicate column rejected",
    prepareAddColumn(applyAddColumnToModel(model, params), params),
  );

  checkPrepareRejected(
    "read-only table rejected",
    prepareAddColumn(model, {
      ...params,
      tableKey: "dbo.InvBuyer",
      columnName: "extra_col",
    }),
  );

  checkPrepareRejected(
    "invalid column name rejected",
    prepareAddColumn(model, {
      ...params,
      columnName: "bad name",
    }),
  );
}

function runRemoveColumnChecks(model: ReturnType<typeof buildProjectModel>["model"]): void {
  const params = {
    tableKey: "dbo.pr_buying_season",
    columnName: "last_modified_user_id",
  };

  const prepared = prepareRemoveColumn(model, params);
  if (checkPrepareOk("remove column candidate builds", prepared)) {
    const candidate = primaryCandidate(prepared);
    check(
      "candidate omits removed column",
      !candidate.candidateContent.includes("last_modified_user_id"),
    );
    check(
      "candidate differs from on-disk source",
      candidate.candidateContent !== candidate.originalContent,
    );
  }

  checkPrepareRejected(
    "PK column removal blocked",
    prepareRemoveColumn(model, {
      tableKey: "dbo.pr_buying_season",
      columnName: "buying_season_id",
    }),
  );

  checkPrepareRejected(
    "FK column removal blocked",
    prepareRemoveColumn(model, {
      tableKey: "dbo.pr_procurement_header",
      columnName: "buying_season_id",
    }),
  );

  checkPrepareRejected(
    "inbound FK reference blocks removal",
    prepareRemoveColumn(model, {
      tableKey: "dbo.pr_port",
      columnName: "port_id",
    }),
  );

  checkPrepareRejected(
    "missing column rejected",
    prepareRemoveColumn(model, {
      ...params,
      columnName: "not_a_column",
    }),
  );
}

function runRenameColumnChecks(model: ReturnType<typeof buildProjectModel>["model"]): void {
  const simpleParams = {
    tableKey: "dbo.pr_buying_season",
    oldName: "last_modified_user_id",
    newName: "last_modified_by_user_id",
  };

  const simplePrepared = prepareRenameColumn(model, simpleParams);
  if (checkPrepareOk("simple rename candidate builds", simplePrepared)) {
    check("simple rename touches one file", simplePrepared.candidates.length === 1);
    const candidate = primaryCandidate(simplePrepared);
    check(
      "candidate emits renamed column",
      candidate.candidateContent.includes("last_modified_by_user_id"),
    );
    check(
      "candidate omits old column name",
      !candidate.candidateContent.includes("last_modified_user_id"),
    );
    check(
      "candidate differs from on-disk source",
      candidate.candidateContent !== candidate.originalContent,
    );
  }

  const pkParams = {
    tableKey: "dbo.pr_port",
    oldName: "port_id",
    newName: "port_identifier",
  };

  const pkPrepared = prepareRenameColumn(model, pkParams);
  if (checkPrepareOk("PK rename with inbound FK candidate builds", pkPrepared)) {
    check("PK rename touches owning and referencing files", pkPrepared.candidates.length === 2);
    check(
      "owning table candidate listed first",
      pkPrepared.candidates[0]?.sourceFile.includes("pr_port") ?? false,
    );

    const portCandidate = pkPrepared.candidates.find((c) => c.sourceFile.includes("pr_port"));
    const headerCandidate = pkPrepared.candidates.find((c) =>
      c.sourceFile.includes("pr_procurement_header"),
    );
    check(
      "owning table emits renamed PK column",
      portCandidate?.candidateContent.includes("port_identifier INT NOT NULL IDENTITY") ?? false,
    );
    check(
      "owning table PK constraint uses new name",
      portCandidate?.candidateContent.includes(
        "CONSTRAINT PK_pr_port PRIMARY KEY (port_identifier)",
      ) ?? false,
    );
    check(
      "referencing table updates inbound FK REFERENCES",
      headerCandidate?.candidateContent.includes(
        "REFERENCES pr_port (port_identifier)",
      ) ?? false,
    );
    check(
      "all candidates differ from on-disk source",
      pkPrepared.candidates.every(
        (candidate) => candidate.candidateContent !== candidate.originalContent,
      ),
    );
  }

  const localFkParams = {
    tableKey: "dbo.pr_procurement_header",
    oldName: "port_of_load_id",
    newName: "load_port_id",
  };

  const localFkPrepared = prepareRenameColumn(model, localFkParams);
  if (checkPrepareOk("local FK column rename candidate builds", localFkPrepared)) {
    check("local FK rename touches one file", localFkPrepared.candidates.length === 1);
    const candidate = primaryCandidate(localFkPrepared);
    check(
      "candidate emits renamed local FK column",
      candidate.candidateContent.includes("load_port_id INT NULL"),
    );
    check(
      "candidate FK constraint uses new local column name",
      candidate.candidateContent.includes(
        "CONSTRAINT FK_pr_procurement_header_pr_port_of_load FOREIGN KEY (load_port_id) REFERENCES pr_port (port_id)",
      ),
    );
  }

  checkPrepareRejected(
    "duplicate new name rejected",
    prepareRenameColumn(model, {
      ...simpleParams,
      newName: "buying_season_name",
    }),
  );

  checkPrepareRejected(
    "missing column rejected",
    prepareRenameColumn(model, {
      ...simpleParams,
      oldName: "not_a_column",
    }),
  );

  checkPrepareRejected(
    "read-only owning table rejected",
    prepareRenameColumn(model, {
      tableKey: "dbo.InvBuyer",
      oldName: "Buyer",
      newName: "BuyerRenamed",
    }),
  );

  checkPrepareRejected(
    "same old and new name rejected",
    prepareRenameColumn(model, {
      ...simpleParams,
      newName: simpleParams.oldName,
    }),
  );
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((l) => (l ? `    ${l}` : l))
    .join("\n");
}

const args = process.argv.slice(2);
if (args.includes("--verify-p1")) {
  void runVerifyP1();
} else if (args.includes("--verify-p3")) {
  runVerifyP3();
} else if (args.includes("--real")) {
  runReal();
} else {
  runFixtures();
}
