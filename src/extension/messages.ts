/**
 * Webview ↔ extension host message protocol (Phase 1).
 */

import type { GraphPayload } from "../graph.ts";

export type HostToWebviewMessage =
  | { type: "graph"; payload: GraphPayload }
  | { type: "error"; message: string };

export type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "layoutUpdate"; tableKey: string; x: number; y: number };

export function isWebviewToHostMessage(value: unknown): value is WebviewToHostMessage {
  if (!value || typeof value !== "object") return false;
  const msg = value as { type?: string };
  switch (msg.type) {
    case "ready":
    case "layoutUpdate":
      return true;
    default:
      return false;
  }
}
