/**
 * Phase 3 rename-column verification checks.
 */

import type { ProjectModel } from "../../model.ts";
import { prepareRenameColumn } from "../../edits/renameColumn.ts";
import type { VerifyHarness } from "../harness.ts";

export function runRenameColumnChecks(h: VerifyHarness, model: ProjectModel): void {
  const simpleParams = {
    tableKey: "dbo.pr_buying_season",
    oldName: "last_modified_user_id",
    newName: "last_modified_by_user_id",
  };

  const simplePrepared = prepareRenameColumn(model, simpleParams);
  if (h.checkPrepareOk("simple rename candidate builds", simplePrepared)) {
    h.check("simple rename touches one file", simplePrepared.candidates.length === 1);
    const candidate = h.primaryCandidate(simplePrepared);
    h.check(
      "candidate emits renamed column",
      candidate.candidateContent.includes("last_modified_by_user_id"),
    );
    h.check(
      "candidate omits old column name",
      !candidate.candidateContent.includes("last_modified_user_id"),
    );
    h.check(
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
  if (h.checkPrepareOk("PK rename with inbound FK candidate builds", pkPrepared)) {
    h.check("PK rename touches owning and referencing files", pkPrepared.candidates.length === 2);
    h.check(
      "owning table candidate listed first",
      pkPrepared.candidates[0]?.sourceFile.includes("pr_port") ?? false,
    );

    const portCandidate = pkPrepared.candidates.find((c) => c.sourceFile.includes("pr_port"));
    const headerCandidate = pkPrepared.candidates.find((c) =>
      c.sourceFile.includes("pr_procurement_header"),
    );
    h.check(
      "owning table emits renamed PK column",
      portCandidate?.candidateContent.includes("port_identifier INT NOT NULL IDENTITY") ?? false,
    );
    h.check(
      "owning table PK constraint uses new name",
      portCandidate?.candidateContent.includes(
        "CONSTRAINT PK_pr_port PRIMARY KEY (port_identifier)",
      ) ?? false,
    );
    h.check(
      "referencing table updates inbound FK REFERENCES",
      headerCandidate?.candidateContent.includes("REFERENCES pr_port (port_identifier)") ?? false,
    );
    h.check(
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
  if (h.checkPrepareOk("local FK column rename candidate builds", localFkPrepared)) {
    h.check("local FK rename touches one file", localFkPrepared.candidates.length === 1);
    const candidate = h.primaryCandidate(localFkPrepared);
    h.check(
      "candidate emits renamed local FK column",
      candidate.candidateContent.includes("load_port_id INT NULL"),
    );
    h.check(
      "candidate FK constraint uses new local column name",
      candidate.candidateContent.includes(
        "CONSTRAINT FK_pr_procurement_header_pr_port_of_load FOREIGN KEY (load_port_id) REFERENCES pr_port (port_id)",
      ),
    );
  }

  h.checkPrepareRejected(
    "duplicate new name rejected",
    prepareRenameColumn(model, {
      ...simpleParams,
      newName: "buying_season_name",
    }),
  );

  h.checkPrepareRejected(
    "missing column rejected",
    prepareRenameColumn(model, {
      ...simpleParams,
      oldName: "not_a_column",
    }),
  );

  h.checkPrepareRejected(
    "read-only owning table rejected",
    prepareRenameColumn(model, {
      tableKey: "dbo.InvBuyer",
      oldName: "Buyer",
      newName: "BuyerRenamed",
    }),
  );

  h.checkPrepareRejected(
    "same old and new name rejected",
    prepareRenameColumn(model, {
      ...simpleParams,
      newName: simpleParams.oldName,
    }),
  );
}
