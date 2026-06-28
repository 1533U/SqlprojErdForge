/**
 * P4-5 edit-comment verification checks (headless).
 */

import {
  applyEditCommentToModel,
  prepareEditComment,
} from "../../edits/editComment.ts";
import type { ProjectModel } from "../../model.ts";
import type { VerifyHarness } from "../harness.ts";

export function runEditCommentChecks(h: VerifyHarness, model: ProjectModel): void {
  // dbo.Customer (comment-slots fixture): Id has "surrogate key", Email has
  // "nullable until verified", Name has no trailing comment.
  const setNew = prepareEditComment(model, {
    tableKey: "dbo.Customer",
    columnName: "Name",
    comment: "display label",
  });
  if (h.checkPrepareOk("set new comment candidate builds", setNew)) {
    const candidate = h.primaryCandidate(setNew);
    h.check(
      "candidate emits the new trailing comment on the Name line",
      candidate.candidateContent
        .split("\n")
        .some((line) => line.includes("Name") && line.includes("-- display label")),
    );
    h.check(
      "candidate differs from on-disk source",
      candidate.candidateContent !== candidate.originalContent,
    );
  }

  const change = prepareEditComment(model, {
    tableKey: "dbo.Customer",
    columnName: "Id",
    comment: "primary surrogate key",
  });
  if (h.checkPrepareOk("change existing comment candidate builds", change)) {
    const candidate = h.primaryCandidate(change);
    h.check(
      "candidate emits the updated comment",
      candidate.candidateContent.includes("-- primary surrogate key"),
    );
    h.check(
      "candidate drops the old comment text",
      !candidate.candidateContent.includes("-- surrogate key"),
    );
  }

  const clear = prepareEditComment(model, {
    tableKey: "dbo.Customer",
    columnName: "Email",
    comment: "   ",
  });
  if (h.checkPrepareOk("clear comment candidate builds", clear)) {
    const candidate = h.primaryCandidate(clear);
    h.check(
      "candidate removes the trailing comment",
      !candidate.candidateContent.includes("-- nullable until verified"),
    );
  }

  h.checkPrepareRejected(
    "no-op comment rejected",
    prepareEditComment(model, {
      tableKey: "dbo.Customer",
      columnName: "Id",
      comment: "surrogate key",
    }),
  );

  h.checkPrepareRejected(
    "missing column rejected",
    prepareEditComment(model, {
      tableKey: "dbo.Customer",
      columnName: "not_a_column",
      comment: "x",
    }),
  );

  h.checkPrepareRejected(
    "read-only table rejected",
    prepareEditComment(model, {
      tableKey: "dbo.InvBuyer",
      columnName: "Buyer",
      comment: "x",
    }),
  );

  // Chained edits: set then clear returns to no trailing comment.
  const afterSet = applyEditCommentToModel(model, {
    tableKey: "dbo.Customer",
    columnName: "Name",
    comment: "temp",
  });
  h.checkPrepareOk(
    "comment can be edited again after a prior edit",
    prepareEditComment(afterSet, {
      tableKey: "dbo.Customer",
      columnName: "Name",
      comment: "final",
    }),
  );
}
