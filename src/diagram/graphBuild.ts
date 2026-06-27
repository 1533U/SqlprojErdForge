/**
 * ProjectModel → serializable ERD graph payload (P1-2).
 */

import { buildEdges } from "../erd.ts";
import { emptyLayout } from "../layout.ts";
import type { Edge, ProjectModel, Table } from "../model.ts";
import { assertNever } from "../model.ts";
import type {
  GraphColumn,
  GraphEdge,
  GraphPayload,
  GraphTable,
  LayoutFile,
} from "../protocol/graphPayload.ts";
import { layoutWithElk } from "./elkLayout.ts";

function tableToGraph(table: Table): GraphTable {
  const pkColumns = new Set<string>();
  const fkColumns = new Set<string>();

  for (const member of table.members) {
    if (member.kind !== "constraint") continue;
    switch (member.constraintType) {
      case "primaryKey":
        for (const col of member.columns) pkColumns.add(col);
        break;
      case "foreignKey":
        for (const col of member.columns) fkColumns.add(col);
        break;
      case "unique":
      case "check":
        break;
      default:
        assertNever(member);
    }
  }

  const columns: GraphColumn[] = [];
  for (const member of table.members) {
    if (member.kind !== "column") continue;
    columns.push({
      name: member.name,
      dataType: member.dataType,
      nullable: member.nullable,
      isPrimaryKey: pkColumns.has(member.name),
      isForeignKey: fkColumns.has(member.name),
      ...(member.trailingComment ? { description: member.trailingComment } : {}),
    });
  }

  return {
    key: `${table.schema}.${table.name}`,
    schema: table.schema,
    name: table.name,
    readOnly: table.readOnly,
    columns,
  };
}

function edgesToGraph(edges: Edge[]): GraphEdge[] {
  return edges.map((edge, index) => ({
    id: `fk-${index}-${edge.constraintName}`,
    from: edge.from,
    to: edge.to,
    label: edge.constraintName,
  }));
}

/** ELK/React Flow require both endpoints to exist as nodes (C10 edges may reference tables outside the project). */
export function filterEdgesToKnownTables(
  edges: GraphEdge[],
  tableKeys: ReadonlySet<string>,
): GraphEdge[] {
  return edges.filter((edge) => tableKeys.has(edge.from) && tableKeys.has(edge.to));
}

export async function buildGraphPayload(
  model: ProjectModel,
  existingLayout: LayoutFile = emptyLayout(),
): Promise<GraphPayload> {
  const tables = [...model.tables.values()]
    .map(tableToGraph)
    .sort((a, b) => a.key.localeCompare(b.key));
  const tableKeys = new Set(tables.map((t) => t.key));
  const edges = filterEdgesToKnownTables(edgesToGraph(buildEdges(model)), tableKeys);
  const layout = await layoutWithElk(tables, edges, existingLayout);
  const projectName = model.projectPath.split(/[/\\]/).pop()?.replace(/\.sqlproj$/i, "") ?? "ERD";

  return { projectName, tables, edges, layout };
}

export { layoutWithElk } from "./elkLayout.ts";
