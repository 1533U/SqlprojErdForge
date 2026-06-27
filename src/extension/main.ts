/**
 * VS Code extension entry point (P1-1).
 */

import * as vscode from "vscode";
import { DiffPreviewController } from "./diffPreview.ts";
import { ErdPanel } from "./erdPanel.ts";

let diffPreview: DiffPreviewController | undefined;

export function activate(context: vscode.ExtensionContext): void {
  diffPreview = new DiffPreviewController(context);

  const openErd = vscode.commands.registerCommand(
    "erdforge.openErd",
    (resource: vscode.Uri | undefined) => {
      const uri = resolveSqlprojUri(resource);
      if (!uri) {
        void vscode.window.showWarningMessage(
          "ErdForge: open a .sqlproj file or run the command from its context menu.",
        );
        return;
      }
      if (!diffPreview) return;
      ErdPanel.open(uri.fsPath, context.extensionUri, diffPreview);
    },
  );

  context.subscriptions.push(openErd);
}

export function deactivate(): void {
  // Panels clean up via onDidDispose.
}

function resolveSqlprojUri(resource: vscode.Uri | undefined): vscode.Uri | undefined {
  if (resource?.fsPath.endsWith(".sqlproj")) {
    return resource;
  }

  const active = vscode.window.activeTextEditor?.document.uri;
  if (active?.fsPath.endsWith(".sqlproj")) {
    return active;
  }

  return undefined;
}
