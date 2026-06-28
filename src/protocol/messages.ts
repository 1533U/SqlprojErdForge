/**
 * Webview ↔ extension host message protocol (shared by host and webview).
 *
 * The edit message variants and the runtime guard are derived from
 * `EditIntentMap` (see `../edits/types.ts`) so the edit operation set has a
 * single source of truth.
 */

import type { GraphPayload } from "./graphPayload.ts";
import type {
  AddColumnParams,
  AddForeignKeyParams,
  AddTableParams,
  ChangeColumnParams,
  DropTableParams,
  EditCommentParams,
  EditIntentMap,
  EditOperationId,
  RemoveColumnParams,
  RenameColumnParams,
  RenameTableParams,
} from "../edits/types.ts";

export type AddForeignKeyIntent = AddForeignKeyParams;
export type AddColumnIntent = AddColumnParams;
export type RemoveColumnIntent = RemoveColumnParams;
export type RenameColumnIntent = RenameColumnParams;
export type ChangeColumnIntent = ChangeColumnParams;
export type EditCommentIntent = EditCommentParams;
export type AddTableIntent = AddTableParams;
export type DropTableIntent = DropTableParams;
export type RenameTableIntent = RenameTableParams;

/** `{ type: "addColumn"; intent: AddColumnParams } | …` for every edit op. */
export type EditMessage = {
  [K in EditOperationId]: { type: K; intent: EditIntentMap[K] };
}[EditOperationId];

export type HostToWebviewMessage =
  | { type: "graph"; payload: GraphPayload }
  | { type: "error"; message: string }
  | { type: "editResult"; ok: true }
  | { type: "editResult"; ok: false; message: string };

export type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "layoutUpdate"; tableKey: string; x: number; y: number }
  | EditMessage;

/**
 * Exhaustive set of edit-op ids. Typed as `Record<EditOperationId, true>` so a
 * new op in `EditIntentMap` is a compile error until listed here.
 */
const EDIT_OP_IDS: Record<EditOperationId, true> = {
  addForeignKey: true,
  addColumn: true,
  removeColumn: true,
  renameColumn: true,
  changeColumn: true,
  editComment: true,
  addTable: true,
  dropTable: true,
  renameTable: true,
};

export function isWebviewToHostMessage(value: unknown): value is WebviewToHostMessage {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: string }).type;
  if (type === undefined) return false;
  if (type === "ready" || type === "layoutUpdate") return true;
  return Object.prototype.hasOwnProperty.call(EDIT_OP_IDS, type);
}
