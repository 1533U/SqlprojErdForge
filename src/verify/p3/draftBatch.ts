/**
 * Draft-batch folding verification checks (direct-manipulation UX).
 */

import type { ProjectModel } from "../../model.ts";
import { foldDraft } from "../../edits/draftBatch.ts";
import { suggestForeignKeyName } from "../../edits/naming.ts";
import type { DraftOp } from "../../edits/types.ts";
import type { VerifyHarness } from "../harness.ts";

export function runDraftBatchChecks(h: VerifyHarness, model: ProjectModel): void {
  // Multiple column edits on one table fold into a single-file combined preview.
  const multiEdit: DraftOp[] = [
    {
      type: "addColumn",
      intent: {
        tableKey: "dbo.pr_buying_season",
        columnName: "draft_note",
        dataType: "VARCHAR(50)",
        nullable: true,
      },
    },
    {
      type: "changeColumn",
      intent: {
        tableKey: "dbo.pr_buying_season",
        columnName: "draft_note",
        dataType: "VARCHAR(100)",
        nullable: false,
      },
    },
  ];
  const folded = foldDraft(model, multiEdit);
  if (h.checkPrepareOk("draft folds multiple edits on one table", folded)) {
    h.check(
      "folded draft yields a single combined candidate",
      folded.candidates.length === 1,
      String(folded.candidates.length),
    );
    const candidate = h.primaryCandidate(folded);
    h.check(
      "combined candidate reflects the final column state",
      candidate.candidateContent.includes("draft_note VARCHAR(100) NOT NULL"),
    );
    h.check(
      "combined candidate omits the intermediate state",
      !candidate.candidateContent.includes("draft_note VARCHAR(50)"),
    );
  }

  // A drag-to-link FK draft folds into a candidate that emits the constraint.
  const fkName = suggestForeignKeyName("dbo.pr_buying_season", "dbo.pr_port");
  const fkDraft: DraftOp[] = [
    {
      type: "addColumn",
      intent: {
        tableKey: "dbo.pr_buying_season",
        columnName: "port_id",
        dataType: "INT",
        nullable: true,
      },
    },
    {
      type: "addForeignKey",
      intent: {
        fromTableKey: "dbo.pr_buying_season",
        fromColumn: "port_id",
        toTableKey: "dbo.pr_port",
        toColumn: "port_id",
        constraintName: fkName,
      },
    },
  ];
  const fkFolded = foldDraft(model, fkDraft);
  if (h.checkPrepareOk("draft folds add-column + drag-to-link FK", fkFolded)) {
    const candidate = h.primaryCandidate(fkFolded);
    h.check(
      "FK draft emits the new column and the FOREIGN KEY",
      candidate.candidateContent.includes("port_id INT NULL") &&
        candidate.candidateContent.includes(`CONSTRAINT ${fkName} FOREIGN KEY`),
    );
  }

  // Empty draft and no-op draft are rejected.
  h.checkPrepareRejected("empty draft rejected", foldDraft(model, []));

  // An invalid op in the batch is rejected, naming the failing position.
  const invalid = foldDraft(model, [
    {
      type: "addColumn",
      intent: {
        tableKey: "dbo.pr_buying_season",
        columnName: "ok_col",
        dataType: "INT",
        nullable: true,
      },
    },
    {
      type: "addColumn",
      intent: {
        tableKey: "dbo.pr_buying_season",
        columnName: "bad name",
        dataType: "INT",
        nullable: true,
      },
    },
  ]);
  h.checkPrepareRejected("draft with an invalid op is rejected", invalid);
  h.check(
    "rejection names the failing op position",
    invalid.ok === false && /Edit 2 of 2/.test(invalid.message),
    invalid.ok === false ? invalid.message : undefined,
  );

  // Read-only table edits are rejected (ADR-0011).
  h.checkPrepareRejected(
    "draft on read-only table rejected",
    foldDraft(model, [
      {
        type: "addColumn",
        intent: {
          tableKey: "dbo.InvBuyer",
          columnName: "extra_col",
          dataType: "INT",
          nullable: true,
        },
      },
    ]),
  );
}
