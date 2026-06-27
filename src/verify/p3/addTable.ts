/**
 * Phase 3 add-table verification checks.
 */

import type { ProjectModel } from "../../model.ts";
import { applyAddTableToModel, prepareAddTable } from "../../edits/addTable.ts";
import { tableIncludePath } from "../../edits/sqlprojEdit.ts";
import type { VerifyHarness } from "../harness.ts";

export function runAddTableChecks(h: VerifyHarness, model: ProjectModel): void {
  const params = {
    schema: "dbo",
    tableName: "pr_test_erdforge_table",
    includeFolder: "purple",
    layoutX: 99,
    layoutY: 88,
  };
  const tableKey = `${params.schema}.${params.tableName}`;
  const include = tableIncludePath(params.includeFolder, params.schema, params.tableName);

  const prepared = prepareAddTable(model, params);
  if (h.checkPrepareOk("add table candidates build", prepared)) {
    h.check(
      "returns table, sqlproj, and layout candidates",
      prepared.candidates.length === 3,
      `count=${prepared.candidates.length}`,
    );

    const sqlCandidate = prepared.candidates.find((c) => c.isNewFile && c.sourceFile.endsWith(".sql"));
    h.check("sql candidate is a new file", sqlCandidate != null);
    if (sqlCandidate) {
      h.check(
        "candidate emits CREATE TABLE with identity PK column",
        sqlCandidate.candidateContent.includes(
          `${params.tableName}_id INT NOT NULL IDENTITY`,
        ),
      );
      h.check(
        "candidate emits named PRIMARY KEY constraint",
        sqlCandidate.candidateContent.includes(
          `CONSTRAINT PK_${params.tableName} PRIMARY KEY (${params.tableName}_id)`,
        ),
      );
      h.check("original content is empty for new file", sqlCandidate.originalContent === "");
    }

    const sqlprojCandidate = prepared.candidates.find((c) => c.absPath.endsWith(".sqlproj"));
    h.check("sqlproj candidate present", sqlprojCandidate != null);
    if (sqlprojCandidate) {
      h.check(
        "sqlproj gains Build Include for new table",
        sqlprojCandidate.candidateContent.includes(`<Build Include="${include}" />`),
      );
    }

    const layoutCandidate = prepared.candidates.find((c) => c.sourceFile.includes("layout.json"));
    h.check("layout candidate present", layoutCandidate != null);
    if (layoutCandidate) {
      h.check(
        "layout gains entry for new table",
        layoutCandidate.candidateContent.includes(`"${tableKey}"`) &&
          layoutCandidate.candidateContent.includes('"x": 99') &&
          layoutCandidate.candidateContent.includes('"y": 88'),
      );
    }
  }

  h.checkPrepareRejected(
    "duplicate table rejected",
    prepareAddTable(applyAddTableToModel(model, params), params),
  );

  h.checkPrepareRejected(
    "invalid table name rejected",
    prepareAddTable(model, { ...params, tableName: "bad name" }),
  );

  h.checkPrepareRejected(
    "invalid schema rejected",
    prepareAddTable(model, { ...params, schema: "bad schema" }),
  );
}
