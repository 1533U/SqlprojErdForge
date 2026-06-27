/**
 * Extension host — map webview edit messages to the edit registry.
 */

import type { ProjectModel } from "../model.ts";
import { editPreviewTitle, prepareEdit, type EditIntentMap, type EditOperationId } from "../edits/registry.ts";
import type { EditValidationResult } from "../edits/types.ts";
import type { WebviewToHostMessage } from "../protocol/messages.ts";

type EditMessage = Extract<
  WebviewToHostMessage,
  {
    type:
      | "addForeignKey"
      | "addColumn"
      | "removeColumn"
      | "renameColumn"
      | "changeColumn";
  }
>;

const EDIT_MESSAGE_TYPES: EditMessage["type"][] = [
  "addForeignKey",
  "addColumn",
  "removeColumn",
  "renameColumn",
  "changeColumn",
];

export function isEditMessage(message: WebviewToHostMessage): message is EditMessage {
  return EDIT_MESSAGE_TYPES.includes(message.type as EditMessage["type"]);
}

export function prepareEditFromMessage(
  model: ProjectModel,
  message: EditMessage,
): { result: EditValidationResult; title: string } {
  switch (message.type) {
    case "addForeignKey":
      return {
        result: prepareEdit("addForeignKey", model, message.intent),
        title: editPreviewTitle("addForeignKey", message.intent),
      };
    case "addColumn":
      return {
        result: prepareEdit("addColumn", model, message.intent),
        title: editPreviewTitle("addColumn", message.intent),
      };
    case "removeColumn":
      return {
        result: prepareEdit("removeColumn", model, message.intent),
        title: editPreviewTitle("removeColumn", message.intent),
      };
    case "renameColumn":
      return {
        result: prepareEdit("renameColumn", model, message.intent),
        title: editPreviewTitle("renameColumn", message.intent),
      };
    case "changeColumn":
      return {
        result: prepareEdit("changeColumn", model, message.intent),
        title: editPreviewTitle("changeColumn", message.intent),
      };
    default: {
      const _exhaustive: never = message;
      throw new Error(`Unhandled edit message: ${(_exhaustive as EditMessage).type}`);
    }
  }
}

export type { EditIntentMap, EditOperationId };
