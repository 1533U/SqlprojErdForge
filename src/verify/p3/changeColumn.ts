/**
 * Phase 3 change-column verification checks.
 */

import type { ProjectModel } from "../../model.ts";
import {
  applyChangeColumnToModel,
  prepareChangeColumn,
} from "../../edits/changeColumn.ts";
import type { VerifyHarness } from "../harness.ts";

export function runChangeColumnChecks(h: VerifyHarness, model: ProjectModel): void {
  const typeParams = {
    tableKey: "dbo.pr_buying_season",
    columnName: "last_modified_user_id",
    dataType: "BIGINT",
    nullable: true,
  };

  const typePrepared = prepareChangeColumn(model, typeParams);
  if (h.checkPrepareOk("change column type candidate builds", typePrepared)) {
    const candidate = h.primaryCandidate(typePrepared);
    h.check(
      "candidate emits new data type",
      candidate.candidateContent.includes("last_modified_user_id BIGINT NULL"),
    );
    h.check(
      "candidate omits old data type for column",
      !candidate.candidateContent.includes("last_modified_user_id INT NULL"),
    );
    h.check(
      "candidate differs from on-disk source",
      candidate.candidateContent !== candidate.originalContent,
    );
  }

  const nullParams = {
    tableKey: "dbo.pr_buying_season",
    columnName: "last_modified_user_id",
    dataType: "INT",
    nullable: false,
  };

  const nullPrepared = prepareChangeColumn(model, nullParams);
  if (h.checkPrepareOk("change column nullability candidate builds", nullPrepared)) {
    const candidate = h.primaryCandidate(nullPrepared);
    h.check(
      "candidate emits NOT NULL",
      candidate.candidateContent.includes("last_modified_user_id INT NOT NULL"),
    );
    h.check(
      "candidate preserves DEFAULT clause on other columns",
      candidate.candidateContent.includes("buying_season_active BIT NOT NULL DEFAULT (1)"),
    );
  }

  const bothParams = {
    tableKey: "dbo.pr_buying_season",
    columnName: "last_modified_user_id",
    dataType: "BIGINT",
    nullable: false,
  };

  const bothPrepared = prepareChangeColumn(
    applyChangeColumnToModel(model, typeParams),
    bothParams,
  );
  if (h.checkPrepareOk("change type and nullability together", bothPrepared)) {
    const candidate = h.primaryCandidate(bothPrepared);
    h.check(
      "candidate emits BIGINT NOT NULL",
      candidate.candidateContent.includes("last_modified_user_id BIGINT NOT NULL"),
    );
  }

  h.checkPrepareRejected(
    "no-op change rejected",
    prepareChangeColumn(model, {
      tableKey: "dbo.pr_buying_season",
      columnName: "last_modified_user_id",
      dataType: "INT",
      nullable: true,
    }),
  );

  h.checkPrepareRejected(
    "PK column cannot become nullable",
    prepareChangeColumn(model, {
      tableKey: "dbo.pr_buying_season",
      columnName: "buying_season_id",
      dataType: "INT",
      nullable: true,
    }),
  );

  h.checkPrepareRejected(
    "IDENTITY column rejected",
    prepareChangeColumn(model, {
      tableKey: "dbo.pr_buying_season",
      columnName: "buying_season_id",
      dataType: "BIGINT",
      nullable: false,
    }),
  );

  h.checkPrepareRejected(
    "temporal generated column rejected",
    prepareChangeColumn(model, {
      tableKey: "dbo.pr_buying_season",
      columnName: "data_valid_from",
      dataType: "DATETIME2(2)",
      nullable: false,
    }),
  );

  h.checkPrepareRejected(
    "missing column rejected",
    prepareChangeColumn(model, {
      ...typeParams,
      columnName: "not_a_column",
    }),
  );

  h.checkPrepareRejected(
    "read-only table rejected",
    prepareChangeColumn(model, {
      ...typeParams,
      tableKey: "dbo.InvBuyer",
      columnName: "Buyer",
    }),
  );

  h.checkPrepareRejected(
    "empty data type rejected",
    prepareChangeColumn(model, {
      ...typeParams,
      dataType: "   ",
    }),
  );
}
