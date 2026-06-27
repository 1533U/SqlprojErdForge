/**
 * Diagram layer barrel — graph projection and layout.
 */

export { buildGraphPayload, filterEdgesToKnownTables, layoutWithElk } from "./diagram/graphBuild.ts";
export { applyLayoutUpdate } from "./layout.ts";
export type {
  GraphColumn,
  GraphEdge,
  GraphPayload,
  GraphTable,
  LayoutFile,
  TableLayout,
} from "./protocol/graphPayload.ts";
