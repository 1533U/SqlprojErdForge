/**
 * Phase 3 drop-table verification checks.
 */

import type { ProjectModel } from "../../model.ts";
import { applyDropTableToModel, prepareDropTable } from "../../edits/dropTable.ts";
import { inboundFkWarningForDrop } from "../../edits/editInteraction.ts";
import { buildEdges } from "../../erd.ts";
import type { VerifyHarness } from "../harness.ts";

export function runDropTableChecks(h: VerifyHarness, model: ProjectModel): void {
  const params = { tableKey: "dbo.pr_shipping_type" };

  const edges = buildEdges(model).map((edge, index) => ({
    from: edge.from,
    to: edge.to,
    label: edge.constraintName,
    id: `fk-${index}`,
  }));
  const warning = inboundFkWarningForDrop(edges, params.tableKey);
  h.check(
    "inbound FK warning lists referencing tables",
    warning != null && warning.includes("dbo.pr_procurement_header"),
    warning,
  );

  const prepared = prepareDropTable(model, params);
  if (h.checkPrepareOk("drop table candidates build", prepared)) {
    h.check(
      "returns sql, sqlproj, and layout candidates",
      prepared.candidates.length === 3,
      `count=${prepared.candidates.length}`,
    );

    const sqlCandidate = prepared.candidates.find((c) => c.isDeleteFile);
    h.check("sql candidate is marked for deletion", sqlCandidate != null);
    if (sqlCandidate) {
      h.check("candidate content is empty", sqlCandidate.candidateContent === "");
      h.check(
        "original content contains CREATE TABLE",
        sqlCandidate.originalContent.includes("CREATE TABLE"),
      );
    }

    const sqlprojCandidate = prepared.candidates.find((c) => c.absPath.endsWith(".sqlproj"));
    h.check("sqlproj candidate present", sqlprojCandidate != null);
    if (sqlprojCandidate) {
      h.check(
        "sqlproj removes Build Include for table",
        !sqlprojCandidate.candidateContent.includes('Include="purple\\dbo.pr_shipping_type.sql"'),
      );
    }

    const layoutCandidate = prepared.candidates.find((c) => c.sourceFile.includes("layout.json"));
    h.check("layout candidate present", layoutCandidate != null);
    if (layoutCandidate) {
      h.check(
        "layout omits dropped table key",
        !layoutCandidate.candidateContent.includes('"dbo.pr_shipping_type"'),
      );
    }
  }

  h.checkPrepareRejected(
    "duplicate drop rejected",
    prepareDropTable(applyDropTableToModel(model, params), params),
  );

  h.checkPrepareRejected(
    "read-only table rejected",
    prepareDropTable(model, { tableKey: "dbo.InvBuyer" }),
  );

  h.checkPrepareRejected(
    "missing table rejected",
    prepareDropTable(model, { tableKey: "dbo.not_a_table" }),
  );
}
