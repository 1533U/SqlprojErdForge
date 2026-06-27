/**
 * Webview ↔ extension host message protocol (shared by host and webview).
 */

import type { GraphPayload } from "./graphPayload.ts";
import type {
  AddColumnParams,
  AddForeignKeyParams,
  AddTableParams,
  ChangeColumnParams,
  DropTableParams,
  RemoveColumnParams,
  RenameColumnParams,
} from "../edits/types.ts";

export type AddForeignKeyIntent = AddForeignKeyParams;
export type AddColumnIntent = AddColumnParams;
export type RemoveColumnIntent = RemoveColumnParams;
export type RenameColumnIntent = RenameColumnParams;
export type ChangeColumnIntent = ChangeColumnParams;
export type AddTableIntent = AddTableParams;
export type DropTableIntent = DropTableParams;

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
  | { type: "renameColumn"; intent: RenameColumnIntent }
  | { type: "changeColumn"; intent: ChangeColumnIntent }
  | { type: "addTable"; intent: AddTableIntent }
  | { type: "dropTable"; intent: DropTableIntent };

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
    case "changeColumn":
    case "addTable":
    case "dropTable":
      return true;
    default:
      return false;
  }
}
