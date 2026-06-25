/**
 * ERD edge derivation (P0-11 / C10 / ADR-0008): edges come *only* from declared
 * FOREIGN KEY constraints. Nothing is inferred from names, types, or column matching.
 */

import type { ProjectModel, Edge } from "./model.ts";

export function buildEdges(model: ProjectModel): Edge[] {
  const edges: Edge[] = [];
  for (const table of model.tables.values()) {
    const from = `${table.schema}.${table.name}`;
    for (const member of table.members) {
      if (member.kind !== "constraint") continue;
      if (member.constraintType !== "foreignKey") continue;
      const refSchema = member.references.schema ?? table.schema;
      edges.push({
        from,
        to: `${refSchema}.${member.references.table}`,
        constraintName: member.name,
        columns: member.columns,
        referencedColumns: member.references.columns,
      });
    }
  }
  return edges;
}
