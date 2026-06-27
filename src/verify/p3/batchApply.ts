/**
 * P4-3 batch apply verification checks.
 */

import {
  candidateEditLabel,
  findRenamePairs,
  usesRefactorPreview,
  validateCandidateBatch,
} from "../../edits/batchCandidates.ts";
import { contentRevision } from "../../edits/paths.ts";
import { prepareAddTable } from "../../edits/addTable.ts";
import { prepareDropTable } from "../../edits/dropTable.ts";
import { prepareRenameColumn } from "../../edits/renameColumn.ts";
import { prepareRenameTable } from "../../edits/renameTable.ts";
import type { ProjectModel } from "../../model.ts";
import type { VerifyHarness } from "../harness.ts";

export function runBatchApplyChecks(h: VerifyHarness, model: ProjectModel): void {
  const renameTable = prepareRenameTable(model, {
    tableKey: "dbo.pr_shipping_type",
    newTableName: "pr_shipment_type",
  });

  if (h.checkPrepareOk("rename table batch candidates", renameTable)) {
    h.check(
      "rename table uses Refactor Preview",
      usesRefactorPreview(renameTable.candidates),
    );

    const pairs = findRenamePairs(renameTable.candidates);
    h.check("rename table has one rename pair", pairs.size === 1);

    const deleteCandidate = renameTable.candidates.find((c) => c.isDeleteFile);
    const createCandidate = renameTable.candidates.find(
      (c) => c.isNewFile && c.sourceFile.endsWith(".sql"),
    );
    h.check(
      "delete and create share renamePairKey",
      deleteCandidate?.renamePairKey != null &&
        deleteCandidate.renamePairKey === createCandidate?.renamePairKey,
    );

    h.check(
      "rename pair label uses source path",
      deleteCandidate != null &&
        candidateEditLabel(deleteCandidate).startsWith("Rename "),
    );

    h.checkPrepareOk(
      "rename table batch validation passes",
      validateCandidateBatch(renameTable.candidates),
    );
  }

  const addTable = prepareAddTable(model, {
    schema: "dbo",
    tableName: "pr_batch_test_table",
    includeFolder: "purple",
  });
  if (h.checkPrepareOk("add table batch candidates", addTable)) {
    h.check("add table uses Refactor Preview", usesRefactorPreview(addTable.candidates));
    h.checkPrepareOk(
      "add table batch validation passes",
      validateCandidateBatch(addTable.candidates),
    );
  }

  const dropTable = prepareDropTable(model, { tableKey: "dbo.pr_shipping_type" });
  if (h.checkPrepareOk("drop table batch candidates", dropTable)) {
    h.check("drop table uses Refactor Preview", usesRefactorPreview(dropTable.candidates));
    h.check(
      "drop delete label",
      dropTable.candidates.some(
        (c) => c.isDeleteFile && candidateEditLabel(c).startsWith("Delete "),
      ),
    );
    h.checkPrepareOk(
      "drop table batch validation passes",
      validateCandidateBatch(dropTable.candidates),
    );
  }

  const renameColumn = prepareRenameColumn(model, {
    tableKey: "dbo.pr_port",
    oldName: "port_id",
    newName: "port_identifier",
  });
  if (h.checkPrepareOk("rename column inbound FK batch", renameColumn)) {
    h.check(
      "rename column with inbound FK uses Refactor Preview",
      usesRefactorPreview(renameColumn.candidates),
    );
    h.checkPrepareOk(
      "rename column batch validation passes",
      validateCandidateBatch(renameColumn.candidates),
    );
  }

  if (renameTable.ok) {
    const stale = renameTable.candidates.map((candidate) => ({
      ...candidate,
      originalRevision: contentRevision("stale content"),
    }));
    h.checkPrepareRejected(
      "stale revision fails batch validation",
      validateCandidateBatch(stale),
    );
  }
}
