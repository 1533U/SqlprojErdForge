/**
 * Diff editor preview with Apply / Discard (single-file) and Refactor Preview (multi-file) — P3-8 / P4-3.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as vscode from "vscode";
import { candidateEditLabel, findRenamePairs } from "../edits/batchCandidates.ts";
import {
  conflictMessage,
  detectBatchConflict,
  detectCandidateConflict,
  hasConflict,
  type CandidateConflict,
} from "../edits/conflict.ts";
import type { FileEditCandidate } from "../edits/types.ts";

const SCHEME = "erdforge-candidate";

/** Re-prepare candidates from fresh disk/model and re-open the preview. */
export type RecomputeEdit = () => Promise<void>;

const RECOMPUTE_ACTION = "Recompute preview";

interface PendingEdit {
  candidate: FileEditCandidate;
  title: string;
  recompute?: RecomputeEdit;
}

class CandidateContentProvider implements vscode.TextDocumentContentProvider {
  private readonly sessions = new Map<string, PendingEdit>();
  private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

  readonly onDidChange = this.onDidChangeEmitter.event;

  setSession(sessionId: string, edit: PendingEdit): void {
    this.sessions.set(sessionId, edit);
  }

  getSession(sessionId: string): PendingEdit | undefined {
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.sessions.get(uri.path)?.candidate.candidateContent ?? "";
  }
}

const PREVIEW_METADATA: vscode.WorkspaceEditEntryMetadata = {
  label: "ErdForge",
  needsConfirmation: true,
};

export class DiffPreviewController {
  private readonly provider = new CandidateContentProvider();
  private activeSessionId: string | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly onAppliedListeners = new Set<() => void>();

  constructor(context: vscode.ExtensionContext) {
    this.disposables.push(
      vscode.workspace.registerTextDocumentContentProvider(SCHEME, this.provider),
      vscode.commands.registerCommand("erdforge.applyEdit", () => this.applyActive()),
      vscode.commands.registerCommand("erdforge.discardEdit", () => this.discardActive()),
    );
    context.subscriptions.push(...this.disposables);
  }

  onApplied(listener: () => void): vscode.Disposable {
    this.onAppliedListeners.add(listener);
    return { dispose: () => this.onAppliedListeners.delete(listener) };
  }

  async show(
    candidates: FileEditCandidate[],
    title: string,
    recompute?: RecomputeEdit,
  ): Promise<void> {
    if (candidates.length === 0) {
      return;
    }
    if (candidates.length === 1) {
      const only = candidates[0];
      if (!only) return;
      await this.showOne(only, title, recompute);
      return;
    }

    await this.showBatchRefactorPreview(candidates, title, recompute);
  }

  private async showOne(
    candidate: FileEditCandidate,
    title: string,
    recompute?: RecomputeEdit,
  ): Promise<void> {
    if (this.activeSessionId) {
      this.provider.deleteSession(this.activeSessionId);
    }

    const sessionId = `edit-${Date.now()}`;
    this.activeSessionId = sessionId;
    this.provider.setSession(sessionId, { candidate, title, recompute });
    await vscode.commands.executeCommand("setContext", "erdforge.pendingEdit", true);

    const originalUri = vscode.Uri.file(candidate.absPath);
    const candidateUri = vscode.Uri.from({
      scheme: SCHEME,
      path: sessionId,
      query: encodeURIComponent(candidate.sourceFile),
    });

    await vscode.commands.executeCommand(
      "vscode.diff",
      originalUri,
      candidateUri,
      title,
      { preview: false },
    );
  }

  private async showBatchRefactorPreview(
    candidates: FileEditCandidate[],
    title: string,
    recompute?: RecomputeEdit,
  ): Promise<void> {
    await this.clearActive();

    const conflict = detectBatchConflict(candidates);
    if (hasConflict(conflict)) {
      await this.promptConflict(conflict, recompute);
      return;
    }

    const edit = await buildBatchWorkspaceEdit(candidates);
    const applied = await vscode.workspace.applyEdit(edit, { isRefactoring: true });
    if (!applied) {
      return;
    }

    await saveTouchedDocuments(candidates);
    markEditApplied();
    void vscode.window.showInformationMessage(`ErdForge: ${title} applied.`);
    for (const listener of this.onAppliedListeners) listener();
  }

  private async applyActive(): Promise<void> {
    if (!this.activeSessionId) {
      void vscode.window.showWarningMessage("ErdForge: no pending edit to apply.");
      return;
    }

    const pending = this.provider.getSession(this.activeSessionId);
    if (!pending) {
      void vscode.window.showWarningMessage("ErdForge: pending edit session expired.");
      await this.clearActive();
      return;
    }

    const { candidate, title, recompute } = pending;

    const conflict = detectCandidateConflict(candidate);
    if (hasConflict(conflict)) {
      await this.clearActive();
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
      await this.promptConflict(conflict, recompute);
      return;
    }

    const uri = vscode.Uri.file(candidate.absPath);
    const edit = new vscode.WorkspaceEdit();

    if (candidate.isDeleteFile) {
      edit.deleteFile(uri, { ignoreIfNotExists: false });
    } else if (candidate.isNewFile) {
      mkdirSync(dirname(candidate.absPath), { recursive: true });
      edit.createFile(uri, { overwrite: false });
      edit.insert(uri, new vscode.Position(0, 0), candidate.candidateContent);
    } else {
      const doc = await vscode.workspace.openTextDocument(uri);
      const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(doc.getText().length),
      );
      edit.replace(uri, fullRange, candidate.candidateContent);
    }

    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
      void vscode.window.showErrorMessage("ErdForge: failed to apply edit.");
      return;
    }

    if (!candidate.isDeleteFile) {
      const doc = await vscode.workspace.openTextDocument(uri);
      await doc.save();
    }
    markEditApplied();

    void vscode.window.showInformationMessage(`ErdForge: ${title} applied.`);
    for (const listener of this.onAppliedListeners) listener();
    await this.clearActive();
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  }

  private async discardActive(): Promise<void> {
    if (!this.activeSessionId) return;
    await this.clearActive();
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  }

  /**
   * Block a conflicting apply (never overwrite) and offer to recompute the
   * preview against the latest on-disk content (P4-4 / ADR-0014).
   */
  private async promptConflict(
    conflict: CandidateConflict,
    recompute?: RecomputeEdit,
  ): Promise<void> {
    const message = `ErdForge: ${conflictMessage(conflict)}`;
    if (!recompute) {
      void vscode.window.showWarningMessage(message);
      return;
    }
    const choice = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      RECOMPUTE_ACTION,
    );
    if (choice === RECOMPUTE_ACTION) {
      await recompute();
    }
  }

  private async clearActive(): Promise<void> {
    if (this.activeSessionId) {
      this.provider.deleteSession(this.activeSessionId);
      this.activeSessionId = undefined;
    }
    await vscode.commands.executeCommand("setContext", "erdforge.pendingEdit", false);
  }
}

async function buildBatchWorkspaceEdit(
  candidates: FileEditCandidate[],
): Promise<vscode.WorkspaceEdit> {
  const edit = new vscode.WorkspaceEdit();
  const renamePairs = findRenamePairs(candidates);
  const consumedRenameKeys = new Set<string>();

  for (const candidate of candidates) {
    const metadata: vscode.WorkspaceEditEntryMetadata = {
      ...PREVIEW_METADATA,
      label: candidateEditLabel(candidate),
    };

    if (candidate.isDeleteFile && candidate.renamePairKey) {
      const pair = renamePairs.get(candidate.renamePairKey);
      if (pair && !consumedRenameKeys.has(candidate.renamePairKey)) {
        consumedRenameKeys.add(candidate.renamePairKey);
        const oldUri = vscode.Uri.file(pair.deleteCandidate.absPath);
        const newUri = vscode.Uri.file(pair.createCandidate.absPath);
        mkdirSync(dirname(pair.createCandidate.absPath), { recursive: true });
        edit.renameFile(oldUri, newUri, { overwrite: false }, metadata);
        edit.replace(
          newUri,
          fullDocumentRange(pair.deleteCandidate.originalContent),
          pair.createCandidate.candidateContent,
          metadata,
        );
        continue;
      }
    }

    if (candidate.isNewFile && candidate.renamePairKey && consumedRenameKeys.has(candidate.renamePairKey)) {
      continue;
    }

    const uri = vscode.Uri.file(candidate.absPath);

    if (candidate.isDeleteFile) {
      edit.deleteFile(uri, { ignoreIfNotExists: false }, metadata);
      continue;
    }

    if (candidate.isNewFile) {
      mkdirSync(dirname(candidate.absPath), { recursive: true });
      edit.createFile(
        uri,
        {
          overwrite: false,
          contents: new TextEncoder().encode(candidate.candidateContent),
        },
        metadata,
      );
      continue;
    }

    const doc = await vscode.workspace.openTextDocument(uri);
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(doc.getText().length),
    );
    edit.replace(uri, fullRange, candidate.candidateContent, metadata);
  }

  return edit;
}

function fullDocumentRange(content: string): vscode.Range {
  const lines = content.split("\n");
  const lastLineIndex = Math.max(0, lines.length - 1);
  const lastLine = lines[lastLineIndex] ?? "";
  return new vscode.Range(
    new vscode.Position(0, 0),
    new vscode.Position(lastLineIndex, lastLine.length),
  );
}

async function saveTouchedDocuments(candidates: FileEditCandidate[]): Promise<void> {
  const renamePairs = findRenamePairs(candidates);
  const saved = new Set<string>();

  for (const candidate of candidates) {
    if (candidate.isDeleteFile) continue;

    let absPath = candidate.absPath;
    if (candidate.isNewFile && candidate.renamePairKey) {
      const pair = renamePairs.get(candidate.renamePairKey);
      if (pair) {
        absPath = pair.createCandidate.absPath;
      }
    }

    if (saved.has(absPath)) continue;
    saved.add(absPath);

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absPath));
      await doc.save();
    } catch {
      // New files may not be openable until after apply settles.
    }
  }
}

/** Briefly ignore watcher events after the extension writes a file. */
let suppressRefreshUntil = 0;

export function suppressRefresh(ms: number): void {
  suppressRefreshUntil = Date.now() + ms;
}

export function isRefreshSuppressed(): boolean {
  return Date.now() < suppressRefreshUntil;
}

/** Called after a successful apply so the ERD panel can refresh once. */
export function markEditApplied(): void {
  suppressRefresh(1500);
}
