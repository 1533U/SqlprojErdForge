/**
 * Surface parse diagnostics in the VS Code Problems panel (P1-6).
 */

import * as vscode from "vscode";
import type { Diagnostic as ModelDiagnostic, ProjectModel } from "../model.ts";

const COLLECTION_ID = "erdforge";

export class ErdDiagnostics {
  private readonly collection = vscode.languages.createDiagnosticCollection(COLLECTION_ID);

  dispose(): void {
    this.collection.dispose();
  }

  publish(model: ProjectModel, projectDir: vscode.Uri): void {
    const byFile = new Map<string, vscode.Diagnostic[]>();

    for (const d of model.diagnostics) {
      const uri = vscode.Uri.joinPath(projectDir, ...d.file.replace(/\\/g, "/").split("/"));
      const range = new vscode.Range(
        Math.max(0, d.line - 1),
        d.column ?? 0,
        Math.max(0, d.line - 1),
        d.column != null ? d.column + 1 : 1000,
      );
      const diagnostic = new vscode.Diagnostic(
        range,
        d.message,
        toSeverity(d),
      );
      diagnostic.source = "ErdForge";
      const list = byFile.get(uri.toString()) ?? [];
      list.push(diagnostic);
      byFile.set(uri.toString(), list);
    }

    this.collection.clear();
    for (const [uriString, diagnostics] of byFile) {
      this.collection.set(vscode.Uri.parse(uriString), diagnostics);
    }
  }

  clear(): void {
    this.collection.clear();
  }
}

function toSeverity(d: ModelDiagnostic): vscode.DiagnosticSeverity {
  switch (d.severity) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    default:
      return vscode.DiagnosticSeverity.Warning;
  }
}
