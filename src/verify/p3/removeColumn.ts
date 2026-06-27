/**
 * Phase 3 remove-column verification checks.
 */

import type { ProjectModel } from "../../model.ts";
import { prepareRemoveColumn } from "../../edits/removeColumn.ts";
import type { VerifyHarness } from "../harness.ts";

export function runRemoveColumnChecks(h: VerifyHarness, model: ProjectModel): void {
  const params = {
    tableKey: "dbo.pr_buying_season",
    columnName: "last_modified_user_id",
  };

  const prepared = prepareRemoveColumn(model, params);
  if (h.checkPrepareOk("remove column candidate builds", prepared)) {
    const candidate = h.primaryCandidate(prepared);
    h.check(
      "candidate omits removed column",
      !candidate.candidateContent.includes("last_modified_user_id"),
    );
    h.check(
      "candidate differs from on-disk source",
      candidate.candidateContent !== candidate.originalContent,
    );
  }

  h.checkPrepareRejected(
    "PK column removal blocked",
    prepareRemoveColumn(model, {
      tableKey: "dbo.pr_buying_season",
      columnName: "buying_season_id",
    }),
  );

  h.checkPrepareRejected(
    "FK column removal blocked",
    prepareRemoveColumn(model, {
      tableKey: "dbo.pr_procurement_header",
      columnName: "buying_season_id",
    }),
  );

  h.checkPrepareRejected(
    "inbound FK reference blocks removal",
    prepareRemoveColumn(model, {
      tableKey: "dbo.pr_port",
      columnName: "port_id",
    }),
  );

  h.checkPrepareRejected(
    "missing column rejected",
    prepareRemoveColumn(model, {
      ...params,
      columnName: "not_a_column",
    }),
  );
}
