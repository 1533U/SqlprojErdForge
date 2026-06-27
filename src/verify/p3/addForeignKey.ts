/**
 * Phase 3 add-FK verification checks.
 */

import type { ProjectModel } from "../../model.ts";
import {
  applyAddForeignKeyToModel,
  prepareAddForeignKey,
  suggestForeignKeyName,
} from "../../edits/addForeignKey.ts";
import type { VerifyHarness } from "../harness.ts";

export function runAddFkChecks(h: VerifyHarness, model: ProjectModel): void {
  const params = {
    fromTableKey: "dbo.pr_buying_season",
    fromColumn: "last_modified_user_id",
    toTableKey: "dbo.pr_port",
    toColumn: "port_id",
    constraintName: "FK_test_erdforge_buying_season_port",
  };

  h.check(
    "suggested FK name",
    suggestForeignKeyName(params.fromTableKey, params.toTableKey) === "FK_pr_buying_season_pr_port",
  );

  const prepared = prepareAddForeignKey(model, params);
  if (h.checkPrepareOk("add FK candidate builds", prepared)) {
    const candidate = h.primaryCandidate(prepared);
    h.check(
      "candidate emits named FOREIGN KEY",
      candidate.candidateContent.includes(
        `CONSTRAINT ${params.constraintName} FOREIGN KEY (last_modified_user_id) REFERENCES dbo.pr_port (port_id)`,
      ),
    );
    h.check(
      "candidate differs from on-disk source",
      candidate.candidateContent !== candidate.originalContent,
    );
  }

  h.checkPrepareRejected(
    "duplicate FK rejected",
    prepareAddForeignKey(applyAddForeignKeyToModel(model, params), params),
  );

  h.checkPrepareRejected(
    "read-only source rejected",
    prepareAddForeignKey(model, {
      fromTableKey: "dbo.InvBuyer",
      fromColumn: "Buyer",
      toTableKey: "dbo.pr_port",
      toColumn: "port_id",
      constraintName: "FK_test_readonly",
    }),
  );

  h.checkPrepareRejected(
    "missing source column rejected",
    prepareAddForeignKey(model, {
      ...params,
      fromColumn: "not_a_column",
    }),
  );
}
