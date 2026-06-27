/**
 * Project loader (P0-12): start from the `.sqlproj`, discover `<Build>` items, normalize
 * Windows backslash paths, filter to `.sql` files, parse each, and assemble a ProjectModel.
 *
 * We only need build-item discovery, not full MSBuild semantics, so include attributes are
 * extracted directly rather than via a general XML parser.
 */

import { readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import type { ProjectModel, Table, Diagnostic } from "./model.ts";
import { parseTable } from "./parser.ts";

export interface BuildItem {
  /** The raw Include path as written in the .sqlproj (may use backslashes). */
  include: string;
  /** OS-normalized absolute path. */
  absPath: string;
  isSql: boolean;
}

export interface DiscoveryResult {
  projectPath: string;
  buildItems: BuildItem[];
  noneItems: string[];
}

/**
 * ADR-0011: read-only mirror tables are classified by explicit path config, never inferred
 * from schema shape. Default rule for the spike: anything under a `syspro/` folder.
 */
export function isReadOnlyInclude(include: string): boolean {
  return /(^|[\\/])syspro[\\/]/i.test(include);
}

export function discover(projectPath: string): DiscoveryResult {
  const xml = readFileSync(projectPath, "utf8");
  const dir = dirname(projectPath);

  const buildIncludes = matchIncludes(xml, "Build");
  const noneIncludes = matchIncludes(xml, "None");

  const buildItems: BuildItem[] = buildIncludes.map((include) => {
    const osRelative = include.replace(/\\/g, sep).replace(/\//g, sep);
    return {
      include,
      absPath: join(dir, osRelative),
      isSql: /\.sql$/i.test(include),
    };
  });

  return { projectPath, buildItems, noneItems: noneIncludes };
}

function matchIncludes(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*?\\bInclude\\s*=\\s*"([^"]+)"`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

export interface BuildResult {
  model: ProjectModel;
  /** Build items that contained no live CREATE TABLE (C9 skips, non-table files). */
  skipped: BuildItem[];
}

export function buildProjectModel(projectPath: string): BuildResult {
  const { buildItems } = discover(projectPath);
  const tables = new Map<string, Table>();
  const diagnostics: Diagnostic[] = [];
  const skipped: BuildItem[] = [];

  for (const item of buildItems) {
    if (!item.isSql) {
      skipped.push(item);
      continue;
    }
    let src: string;
    try {
      src = readFileSync(item.absPath, "utf8");
    } catch {
      diagnostics.push({
        file: item.include,
        line: 0,
        severity: "error",
        message: `Build item not found on disk: ${item.absPath}`,
      });
      continue;
    }
    const result = parseTable(src, item.include);
    diagnostics.push(...result.diagnostics);
    if (!result.table) {
      skipped.push(item); // C9: commented-out or non-table file.
      continue;
    }
    result.table.sourceFile = item.include;
    result.table.readOnly = isReadOnlyInclude(item.include);
    tables.set(`${result.table.schema}.${result.table.name}`, result.table);
  }

  return { model: { projectPath, tables, diagnostics }, skipped };
}
