/**
 * Webview ↔ extension host message protocol.
 */

import type { GraphPayload } from "../graph.ts";

export interface AddForeignKeyIntent {
  fromTableKey: string;
  fromColumn: string;
  toTableKey: string;
  toColumn: string;
  constraintName: string;
}

export type HostToWebviewMessage =
  | { type: "graph"; payload: GraphPayload }
  | { type: "error"; message: string }
  | { type: "editResult"; ok: true }
  | { type: "editResult"; ok: false; message: string };

export type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "layoutUpdate"; tableKey: string; x: number; y: number }
  | { type: "addForeignKey"; intent: AddForeignKeyIntent };

export function isWebviewToHostMessage(value: unknown): value is WebviewToHostMessage {
  if (!value || typeof value !== "object") return false;
  const msg = value as { type?: string };
  switch (msg.type) {
    case "ready":
    case "layoutUpdate":
    case "addForeignKey":
      return true;
    default:
      return false;
  }
}
