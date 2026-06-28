/**
 * Extension host — map webview edit messages to the edit registry.
 *
 * The set of edit message types is derived from the edit registry
 * (`editOperations`), so adding an operation there is the single source of truth.
 */

import type { ProjectModel } from "../model.ts";
import {
  editOperations,
  editPreviewTitle,
  prepareEdit,
  type EditIntentMap,
  type EditOperationId,
} from "../edits/registry.ts";
import type { EditValidationResult } from "../edits/types.ts";
import type { WebviewToHostMessage } from "../protocol/messages.ts";

export type EditMessage = Extract<WebviewToHostMessage, { type: EditOperationId }>;

const EDIT_MESSAGE_TYPES = new Set<string>(Object.keys(editOperations));

export function isEditMessage(message: WebviewToHostMessage): message is EditMessage {
  return EDIT_MESSAGE_TYPES.has(message.type);
}

export function prepareEditFromMessage(
  model: ProjectModel,
  message: EditMessage,
): { result: EditValidationResult; title: string } {
  return {
    result: prepareEdit(message.type, model, message.intent),
    title: editPreviewTitle(message.type, message.intent),
  };
}

export type { EditIntentMap, EditOperationId };
