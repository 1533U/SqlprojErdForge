/**
 * Diff editor preview with Apply / Discard (P3-8 / docs/06-edit-ux.md option 1).
 */

import { readFileSync } from "node:fs";
import * as vscode from "vscode";
import { contentRevision } from "../edits/paths.ts";
import type { FileEditCandidate } from "../edits/types.ts";

const SCHEME = "erdforge-candidate";

interface PendingEdit {
  candidate: FileEditCandidate;
  title: string;
}

interface PendingSequence {
  candidates: FileEditCandidate[];
  baseTitle: string;
  index: number;
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

export class DiffPreviewController {
  private readonly provider = new CandidateContentProvider();
  private activeSessionId: string | undefined;
  private pendingSequence: PendingSequence | undefined;
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

  async show(candidates: FileEditCandidate[], title: string): Promise<void> {
    if (candidates.length === 0) {
      return;
    }
    if (candidates.length === 1) {
      this.pendingSequence = undefined;
      const only = candidates[0];
      if (!only) return;
      await this.showOne(only, title);
      return;
    }

    this.pendingSequence = { candidates, baseTitle: title, index: 0 };
    await this.showCurrentInSequence();
  }

  private async showOne(candidate: FileEditCandidate, title: string): Promise<void> {
    if (this.activeSessionId) {
      this.provider.deleteSession(this.activeSessionId);
    }

    const sessionId = `edit-${Date.now()}`;
    this.activeSessionId = sessionId;
    this.provider.setSession(sessionId, { candidate, title });
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

  private async showCurrentInSequence(): Promise<void> {
    const sequence = this.pendingSequence;
    if (!sequence) return;

    const candidate = sequence.candidates[sequence.index];
    if (!candidate) {
      await this.clearActive();
      return;
    }
    const title = `${sequence.baseTitle} (${sequence.index + 1}/${sequence.candidates.length})`;
    await this.showOne(candidate, title);
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

    const { candidate, title } = pending;
    let currentContent: string;
    try {
      currentContent = readFileSync(candidate.absPath, "utf8");
    } catch {
      void vscode.window.showErrorMessage("ErdForge: source file no longer exists.");
      return;
    }

    if (contentRevision(currentContent) !== candidate.originalRevision) {
      void vscode.window.showWarningMessage(
        "ErdForge: the file changed since the preview was generated. Discard and retry the edit from the ERD.",
      );
      return;
    }

    const uri = vscode.Uri.file(candidate.absPath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(doc.getText().length),
    );
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, fullRange, candidate.candidateContent);
    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
      void vscode.window.showErrorMessage("ErdForge: failed to apply edit.");
      return;
    }

    await doc.save();
    markEditApplied();

    const sequence = this.pendingSequence;
    if (sequence && sequence.index + 1 < sequence.candidates.length) {
      sequence.index += 1;
      void vscode.window.showInformationMessage(
        `ErdForge: ${title} applied. Review the next file (${sequence.index + 1}/${sequence.candidates.length}).`,
      );
      await this.showCurrentInSequence();
      return;
    }

    void vscode.window.showInformationMessage(`ErdForge: ${title} applied.`);
    for (const listener of this.onAppliedListeners) listener();
    await this.clearActive();
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  }

  private async discardActive(): Promise<void> {
    if (!this.activeSessionId && !this.pendingSequence) return;
    await this.clearActive();
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  }

  private async clearActive(): Promise<void> {
    this.pendingSequence = undefined;
    if (this.activeSessionId) {
      this.provider.deleteSession(this.activeSessionId);
      this.activeSessionId = undefined;
    }
    await vscode.commands.executeCommand("setContext", "erdforge.pendingEdit", false);
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
