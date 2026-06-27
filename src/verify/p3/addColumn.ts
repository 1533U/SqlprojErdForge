/**
 * Phase 3 add-column verification checks.
 */

import type { Member, ProjectModel, Table } from "../../model.ts";
import { applyAddColumnToModel, prepareAddColumn } from "../../edits/addColumn.ts";
import type { VerifyHarness } from "../harness.ts";

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

export function runAddColumnChecks(h: VerifyHarness, model: ProjectModel): void {
  const params = {
    tableKey: "dbo.pr_buying_season",
    columnName: "test_column_erdforge",
    dataType: "INT",
    nullable: true,
    trailingComment: "added by verify:p3",
  };

  const prepared = prepareAddColumn(model, params);
  if (h.checkPrepareOk("add column candidate builds", prepared)) {
    const candidate = h.primaryCandidate(prepared);
    h.check(
      "candidate emits new column before constraints",
      candidate.candidateContent.includes("test_column_erdforge INT NULL, -- added by verify:p3"),
    );
    h.check(
      "candidate differs from on-disk source",
      candidate.candidateContent !== candidate.originalContent,
    );

    const mutated = applyAddColumnToModel(model, params);
    const table = mutated.tables.get(params.tableKey);
    const names = table ? memberNames(table) : [];
    h.check(
      "new column inserted before PERIOD/PK",
      names.indexOf("test_column_erdforge") < names.indexOf("PERIOD"),
      JSON.stringify(names),
    );
  }

  h.checkPrepareRejected(
    "duplicate column rejected",
    prepareAddColumn(applyAddColumnToModel(model, params), params),
  );

  h.checkPrepareRejected(
    "read-only table rejected",
    prepareAddColumn(model, {
      ...params,
      tableKey: "dbo.InvBuyer",
      columnName: "extra_col",
    }),
  );

  h.checkPrepareRejected(
    "invalid column name rejected",
    prepareAddColumn(model, {
      ...params,
      columnName: "bad name",
    }),
  );
}
