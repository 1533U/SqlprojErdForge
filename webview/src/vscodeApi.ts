/** VS Code webview API — must be acquired exactly once per session. */
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

export const vscode = acquireVsCodeApi();
