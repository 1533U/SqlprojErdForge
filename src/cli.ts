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
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Table, Column, Member } from "./model.ts";
import { parseTable } from "./parser.ts";
import { emitTable } from "./emitter.ts";
import { buildProjectModel, discover } from "./project.ts";
import { buildEdges } from "./erd.ts";

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

function findColumn(table: Table, name: string): Column | undefined {
  return table.members.find(
    (m): m is Column => m.kind === "column" && m.name === name,
  );
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

function indent(text: string): string {
  return text
    .split("\n")
    .map((l) => (l ? `    ${l}` : l))
    .join("\n");
}

const real = process.argv.includes("--real");
if (real) runReal();
else runFixtures();
