/**
 * Phase 3 rename-table verification checks.
 */

import type { ProjectModel } from "../../model.ts";
import { applyRenameTableToModel, prepareRenameTable } from "../../edits/renameTable.ts";
import { renameTableIncludePath } from "../../edits/sqlprojEdit.ts";
import type { VerifyHarness } from "../harness.ts";

export function runRenameTableChecks(h: VerifyHarness, model: ProjectModel): void {
  const params = {
    tableKey: "dbo.pr_shipping_type",
    newTableName: "pr_shipment_type",
  };
  const newTableKey = "dbo.pr_shipment_type";
  const oldInclude = "purple\\dbo.pr_shipping_type.sql";
  const newInclude = renameTableIncludePath(oldInclude, "dbo", params.newTableName);

  const prepared = prepareRenameTable(model, params);
  if (h.checkPrepareOk("rename table candidates build", prepared)) {
    h.check(
      "returns delete, create, inbound FK, sqlproj, and layout candidates",
      prepared.candidates.length === 5,
      `count=${prepared.candidates.length}`,
    );

    const deleteCandidate = prepared.candidates.find((c) => c.isDeleteFile);
    h.check("old sql candidate is marked for deletion", deleteCandidate != null);
    if (deleteCandidate) {
      h.check("delete candidate uses old include path", deleteCandidate.sourceFile === oldInclude);
      h.check(
        "delete candidate original contains CREATE TABLE",
        deleteCandidate.originalContent.includes("CREATE TABLE"),
      );
    }

    const createCandidate = prepared.candidates.find(
      (c) => c.isNewFile && c.sourceFile.endsWith(".sql"),
    );
    h.check("new sql candidate is a new file", createCandidate != null);
    if (createCandidate) {
      h.check("new file uses renamed include path", createCandidate.sourceFile === newInclude);
      h.check(
        "new file emits renamed CREATE TABLE",
        createCandidate.candidateContent.includes("CREATE TABLE dbo.pr_shipment_type"),
      );
      const createLine = createCandidate.candidateContent
        .split("\n")
        .find((line) => line.startsWith("CREATE TABLE"));
      h.check(
        "CREATE TABLE line omits old table name",
        createLine != null &&
          createLine.includes("pr_shipment_type") &&
          !createLine.includes("pr_shipping_type"),
      );
    }

    const headerCandidate = prepared.candidates.find((c) =>
      c.sourceFile.includes("pr_procurement_header"),
    );
    h.check("inbound FK referencing file present", headerCandidate != null);
    if (headerCandidate) {
      h.check(
        "referencing file updates inbound FK REFERENCES",
        headerCandidate.candidateContent.includes(
          "REFERENCES pr_shipment_type (shipping_type_code)",
        ),
      );
      h.check(
        "referencing file omits old REFERENCES target",
        !headerCandidate.candidateContent.includes("REFERENCES pr_shipping_type"),
      );
    }

    const sqlprojCandidate = prepared.candidates.find((c) => c.absPath.endsWith(".sqlproj"));
    h.check("sqlproj candidate present", sqlprojCandidate != null);
    if (sqlprojCandidate) {
      h.check(
        "sqlproj replaces Build Include for table",
        !sqlprojCandidate.candidateContent.includes(`Include="${oldInclude}"`) &&
          sqlprojCandidate.candidateContent.includes(`Include="${newInclude}"`),
      );
    }

    const layoutCandidate = prepared.candidates.find((c) => c.sourceFile.includes("layout.json"));
    h.check("layout candidate present", layoutCandidate != null);
    if (layoutCandidate) {
      h.check(
        "layout migrates table key",
        layoutCandidate.candidateContent.includes(`"${newTableKey}"`) &&
          !layoutCandidate.candidateContent.includes('"dbo.pr_shipping_type"'),
      );
    }
  }

  h.checkPrepareRejected(
    "duplicate rename rejected",
    prepareRenameTable(applyRenameTableToModel(model, params), params),
  );

  h.checkPrepareRejected(
    "same name rejected",
    prepareRenameTable(model, { ...params, newTableName: "pr_shipping_type" }),
  );

  h.checkPrepareRejected(
    "read-only table rejected",
    prepareRenameTable(model, { tableKey: "dbo.InvBuyer", newTableName: "InvBuyerRenamed" }),
  );

  h.checkPrepareRejected(
    "missing table rejected",
    prepareRenameTable(model, { tableKey: "dbo.not_a_table", newTableName: "pr_new_name" }),
  );

  h.checkPrepareRejected(
    "invalid table name rejected",
    prepareRenameTable(model, { ...params, newTableName: "bad name" }),
  );
}
