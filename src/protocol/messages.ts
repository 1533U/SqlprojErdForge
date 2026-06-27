/**
 * Webview ↔ extension host message protocol (shared by host and webview).
 */

import type { GraphPayload } from "./graphPayload.ts";

export interface AddForeignKeyIntent {
  fromTableKey: string;
  fromColumn: string;
  toTableKey: string;
  toColumn: string;
  constraintName: string;
}

export interface AddColumnIntent {
  tableKey: string;
  columnName: string;
  dataType: string;
  nullable: boolean;
  trailingComment?: string;
}

export interface RemoveColumnIntent {
  tableKey: string;
  columnName: string;
}

export interface RenameColumnIntent {
  tableKey: string;
  oldName: string;
  newName: string;
}

export type HostToWebviewMessage =
  | { type: "graph"; payload: GraphPayload }
  | { type: "error"; message: string }
  | { type: "editResult"; ok: true }
  | { type: "editResult"; ok: false; message: string };

export type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "layoutUpdate"; tableKey: string; x: number; y: number }
  | { type: "addForeignKey"; intent: AddForeignKeyIntent }
  | { type: "addColumn"; intent: AddColumnIntent }
  | { type: "removeColumn"; intent: RemoveColumnIntent }
  | { type: "renameColumn"; intent: RenameColumnIntent };

export function isWebviewToHostMessage(value: unknown): value is WebviewToHostMessage {
  if (!value || typeof value !== "object") return false;
  const msg = value as { type?: string };
  switch (msg.type) {
    case "ready":
    case "layoutUpdate":
    case "addForeignKey":
    case "addColumn":
    case "removeColumn":
    case "renameColumn":
      return true;
    default:
      return false;
  }
}
