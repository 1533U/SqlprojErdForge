/**
 * Phase 0 fixture spike (P0-5 exit criteria).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Member, Table } from "../model.ts";
import { emitTable } from "../emitter.ts";
import { buildEdges } from "../erd.ts";
import { findColumn } from "../edits/memberChecks.ts";
import { parseTable } from "../parser.ts";
import { buildProjectModel, discover } from "../project.ts";
import { VerifyHarness, indent } from "./harness.ts";
import { FIXTURES, SAMPLE_PROJECT } from "./paths.ts";

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

export function runFixtures(): void {
  const h = new VerifyHarness();
  console.log("SqlprojErdForge — Phase 0 spike (fixtures)\n");

  console.log("Discovery from SampleErd.sqlproj:");
  const disc = discover(SAMPLE_PROJECT);
  const sqlItems = disc.buildItems.filter((b) => b.isSql);
  const nonSql = disc.buildItems.filter((b) => !b.isSql);
  console.log(
    `  build items: ${disc.buildItems.length} (sql: ${sqlItems.length}, non-sql: ${nonSql.length}); <None>: ${disc.noneItems.length}`,
  );
  h.check(
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
  console.log(
    `  parsed tables: ${model.tables.size}; skipped (non-table / commented-out): ${skipped.length}`,
  );
  console.log(`  diagnostics: ${model.diagnostics.length}`);
  for (const d of model.diagnostics) {
    console.log(`    - ${d.severity} ${d.file}:${d.line} ${d.message}`);
  }

  console.log("\nC9 — commented-out schema is ignored:");
  h.check("dbo.TierMatrix yields no table", !model.tables.has("dbo.TierMatrix"));
  const item = model.tables.get("dbo.pr_procurement_item");
  h.check("pr_procurement_item parsed", !!item);
  if (item) {
    h.check(
      "commented-out column erp_po_master_plus_loaded is not a column",
      !findColumn(item, "erp_po_master_plus_loaded"),
    );
    const noTierMatrixDiag = !model.diagnostics.some(
      (d) => /TierMatrix/i.test(d.file) && d.severity === "error",
    );
    h.check("TierMatrix produced no diagnostic", noTierMatrixDiag);
  }

  console.log("\nC10 — ERD edges only from declared FOREIGN KEYs:");
  const edges = buildEdges(model);
  console.log(`  total edges: ${edges.length}`);
  const header = model.tables.get("dbo.pr_procurement_header");
  if (header) {
    const targets = edges
      .filter((e) => e.from === "dbo.pr_procurement_header")
      .map((e) => e.to)
      .sort();
    const expected = [
      "dbo.pr_buying_season",
      "dbo.pr_port",
      "dbo.pr_port",
      "dbo.pr_procurement_header_status",
      "dbo.pr_shipping_type",
      "dbo.pr_supplier",
      "dbo.pr_syspro_buyer",
    ].sort();
    h.check(
      "pr_procurement_header has exactly its 7 declared FK edges",
      JSON.stringify(targets) === JSON.stringify(expected),
      JSON.stringify(targets),
    );
  }
  if (item) {
    const itemTargets = edges.filter((e) => e.from === "dbo.pr_procurement_item").map((e) => e.to);
    h.check(
      "commented-out FKs (pr_color / pr_finish) produce no edges",
      !itemTargets.includes("dbo.pr_color") && !itemTargets.includes("dbo.pr_finish"),
    );
    h.check(
      "unbracketed REFERENCES pr_tariff_code yields an edge",
      itemTargets.includes("dbo.pr_tariff_code"),
    );
  }
  const invBuyer = model.tables.get("dbo.InvBuyer");
  h.check("dbo.InvBuyer parsed", !!invBuyer);
  if (invBuyer) {
    h.check("InvBuyer (no FKs) has no outgoing edges", !edges.some((e) => e.from === "dbo.InvBuyer"));
    h.check("InvBuyer is classified read-only (ADR-0011)", invBuyer.readOnly === true);
  }

  console.log("\nComment model — four slots + footer fallback:");
  const csSrc = readFileSync(join(FIXTURES, "comments", "dbo.CommentSlots.sql"), "utf8");
  const cs = parseTable(csSrc, "dbo.CommentSlots.sql").table;
  h.check("CommentSlots parsed", !!cs);
  if (cs) {
    h.check(
      "header slot",
      JSON.stringify(cs.headerComments) === JSON.stringify(["Customer master record"]),
      JSON.stringify(cs.headerComments),
    );
    const id = findColumn(cs, "Id");
    const name = findColumn(cs, "Name");
    const email = findColumn(cs, "Email");
    h.check("trailing slot (Id)", id?.trailingComment === "surrogate key", id?.trailingComment);
    h.check(
      "leading slot (Name)",
      JSON.stringify(name?.leadingComments) === JSON.stringify(["display name shown in the UI"]),
      JSON.stringify(name?.leadingComments),
    );
    h.check(
      "trailing slot (Email)",
      email?.trailingComment === "nullable until verified",
      email?.trailingComment,
    );
    h.check(
      "footer slot incl. rule-5 fallback",
      JSON.stringify(cs.footerComments) ===
        JSON.stringify(["audit columns still TODO", "Owned by the Accounts team"]),
      JSON.stringify(cs.footerComments),
    );
  }

  console.log("\nStable fixed point — emit(parse(emit(x))) === emit(parse(x)):");
  const roundTripFiles = sqlItems.map((b) => b.absPath);
  let normalized = 0;
  let roundTripped = 0;
  for (const file of roundTripFiles) {
    const src = readFileSync(file, "utf8");
    const first = parseTable(src, file);
    if (!first.table) continue;
    roundTripped++;
    const e1 = emitTable(first.table);
    const second = parseTable(e1, file);
    const ok2 = !!second.table;
    const e2 = ok2 ? emitTable(second.table as Table) : "";
    h.check(`fixed point: ${first.table.sourceFile}`, ok2 && e1 === e2);
    if (e1 !== src) normalized++;
  }
  console.log(
    `  (${normalized}/${roundTripped} files required a one-time normalization pass; all reach a fixed point thereafter)`,
  );

  console.log("\nSample canonical output (dbo.pr_procurement_header_status):");
  const sample = model.tables.get("dbo.pr_procurement_header_status");
  if (sample) console.log(indent(emitTable(sample)));

  h.exitWithSummary("ALL CHECKS PASSED", "{n} CHECK(S) FAILED");
}
