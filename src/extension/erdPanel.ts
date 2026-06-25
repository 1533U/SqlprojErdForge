/**
 * ERD webview panel: loads the project model, layout sidecar, watcher, and diagnostics.
 */

import { dirname } from "node:path";
import * as vscode from "vscode";
import { applyLayoutUpdate, buildGraphPayload } from "../graph.ts";
import type { GraphPayload } from "../graph.ts";
import { readLayout, writeLayout } from "../layout.ts";
import type { LayoutFile } from "../layout.ts";
import type { ProjectModel } from "../model.ts";
import { buildProjectModel } from "../project.ts";
import { ErdDiagnostics } from "./diagnostics.ts";
import { isWebviewToHostMessage, type HostToWebviewMessage } from "./messages.ts";
import { watchSqlFiles } from "./watcher.ts";

export class ErdPanel {
  private static readonly viewType = "erdforge.erdPanel";
  private static panels = new Map<string, ErdPanel>();

  private readonly panel: vscode.WebviewPanel;
  private readonly projectPath: string;
  private readonly projectDir: vscode.Uri;
  private readonly extensionUri: vscode.Uri;
  private layout: LayoutFile;
  private model: ProjectModel | undefined;
  private readonly diagnostics: ErdDiagnostics;
  private readonly watcher: ReturnType<typeof watchSqlFiles>;
  private readonly disposables: vscode.Disposable[] = [];
  private webviewReady = false;
  private pendingPayload: GraphPayload | undefined;

  private constructor(
    panel: vscode.WebviewPanel,
    projectPath: string,
    extensionUri: vscode.Uri,
  ) {
    this.panel = panel;
    this.projectPath = projectPath;
    this.projectDir = vscode.Uri.file(dirname(projectPath));
    this.extensionUri = extensionUri;
    this.layout = readLayout(projectPath);
    this.diagnostics = new ErdDiagnostics();
    this.watcher = watchSqlFiles(this.projectDir, () => {
      void this.refresh();
    });

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "out", "webview")],
    };
    panel.webview.html = this.getHtml(panel.webview);
    panel.onDidDispose(() => this.dispose(), null, this.disposables);

    panel.webview.onDidReceiveMessage(
      (message: unknown) => this.onWebviewMessage(message),
      undefined,
      this.disposables,
    );

    void this.refresh();
  }

  static open(projectPath: string, extensionUri: vscode.Uri): ErdPanel {
    const existing = ErdPanel.panels.get(projectPath);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.One);
      return existing;
    }

    const title = projectPath.split(/[/\\]/).pop()?.replace(/\.sqlproj$/i, "") ?? "ERD";
    const panel = vscode.window.createWebviewPanel(
      ErdPanel.viewType,
      `ERD — ${title}`,
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );

    const erdPanel = new ErdPanel(panel, projectPath, extensionUri);
    ErdPanel.panels.set(projectPath, erdPanel);
    return erdPanel;
  }

  private dispose(): void {
    ErdPanel.panels.delete(this.projectPath);
    this.watcher.dispose();
    this.diagnostics.dispose();
    for (const d of this.disposables) d.dispose();
  }

  private async refresh(): Promise<void> {
    try {
      const { model } = buildProjectModel(this.projectPath);
      this.model = model;
      this.diagnostics.publish(model, this.projectDir);

      const beforeKeys = new Set(Object.keys(this.layout.tables));
      const basePayload = await buildGraphPayload(model, this.layout);
      const addedKeys = Object.keys(basePayload.layout.tables).filter((k) => !beforeKeys.has(k));
      if (addedKeys.length > 0) {
        this.layout = mergeLayouts(this.layout, basePayload.layout);
        writeLayout(this.projectPath, this.layout);
      }

      const payload: GraphPayload = { ...basePayload, layout: this.layout };
      this.sendGraph(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.postMessage({ type: "error", message });
      void vscode.window.showErrorMessage(`ErdForge: ${message}`);
    }
  }

  private sendGraph(payload: GraphPayload): void {
    if (!this.webviewReady) {
      this.pendingPayload = payload;
      return;
    }
    this.pendingPayload = undefined;
    this.postMessage({ type: "graph", payload });
  }

  private postMessage(message: HostToWebviewMessage): void {
    void this.panel.webview.postMessage(message);
  }

  private onWebviewMessage(message: unknown): void {
    if (!isWebviewToHostMessage(message)) return;

    switch (message.type) {
      case "ready":
        this.webviewReady = true;
        if (this.pendingPayload) {
          this.sendGraph(this.pendingPayload);
        } else if (this.model) {
          void this.refresh();
        }
        break;
      case "layoutUpdate":
        this.layout = applyLayoutUpdate(
          this.layout,
          message.tableKey,
          message.x,
          message.y,
        );
        writeLayout(this.projectPath, this.layout);
        break;
      default:
        break;
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "out", "webview", "main.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "out", "webview", "main.css"),
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>ErdForge ERD</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

function mergeLayouts(saved: LayoutFile, computed: LayoutFile): LayoutFile {
  const tables = { ...computed.tables, ...saved.tables };
  return { version: 1, tables };
}

