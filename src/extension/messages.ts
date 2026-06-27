/**
 * Webview ↔ extension host message protocol.
 */

export type {
  AddColumnIntent,
  AddForeignKeyIntent,
  HostToWebviewMessage,
  RemoveColumnIntent,
  RenameColumnIntent,
  WebviewToHostMessage,
} from "../protocol/messages.ts";
export { isWebviewToHostMessage } from "../protocol/messages.ts";
