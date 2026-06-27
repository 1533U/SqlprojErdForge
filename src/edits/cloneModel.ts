/**
 * Deep-clone helpers for edit previews (model is mutated only on copies until apply).
 */

import type { ProjectModel } from "../model.ts";

export function cloneProjectModel(model: ProjectModel): ProjectModel {
  return {
    projectPath: model.projectPath,
    tables: new Map(
      [...model.tables.entries()].map(([key, table]) => [key, structuredClone(table)]),
    ),
    diagnostics: [...model.diagnostics],
  };
}
