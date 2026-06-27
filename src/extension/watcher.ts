/**
 * FileSystemWatcher → debounced re-parse → refresh (P1-4).
 */

import * as vscode from "vscode";
import { isRefreshSuppressed } from "./diffPreview.ts";

export interface DebouncedWatcher {
  dispose(): void;
}

export function watchSqlFiles(
  projectDir: vscode.Uri,
  onChange: () => void,
  debounceMs = 500,
): DebouncedWatcher {
  const pattern = new vscode.RelativePattern(projectDir, "**/*.sql");
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = (): void => {
    if (isRefreshSuppressed()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (isRefreshSuppressed()) return;
      onChange();
    }, debounceMs);
  };

  watcher.onDidChange(schedule);
  watcher.onDidCreate(schedule);
  watcher.onDidDelete(schedule);

  return {
    dispose(): void {
      if (timer) clearTimeout(timer);
      watcher.dispose();
    },
  };
}
