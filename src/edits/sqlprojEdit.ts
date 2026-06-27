/**
 * Insert `<Build Include="...">` items into a `.sqlproj` (P3-5).
 */

export function tableIncludePath(folder: string, schema: string, tableName: string): string {
  const file = `${schema}.${tableName}.sql`;
  const trimmed = folder.trim().replace(/[/\\]+$/, "");
  if (!trimmed) {
    return file;
  }
  const segments = trimmed.replace(/\\/g, "/").split("/").filter(Boolean);
  return `${segments.join("\\")}\\${file}`;
}

export function buildIncludeExists(sqlprojXml: string, include: string): boolean {
  const escaped = include.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<Build\\b[^>]*\\bInclude\\s*=\\s*"${escaped}"`, "i").test(sqlprojXml);
}

export function removeBuildInclude(sqlprojXml: string, include: string): string {
  if (!buildIncludeExists(sqlprojXml, include)) {
    return sqlprojXml;
  }

  const escaped = include.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lineRe = new RegExp(`^\\s*<Build\\b[^>]*\\bInclude\\s*=\\s*"${escaped}"\\s*/>\\s*\\r?\\n?`, "im");
  return sqlprojXml.replace(lineRe, "");
}

export function replaceBuildInclude(
  sqlprojXml: string,
  oldInclude: string,
  newInclude: string,
): string {
  if (oldInclude === newInclude) {
    return sqlprojXml;
  }
  if (!buildIncludeExists(sqlprojXml, oldInclude)) {
    return insertBuildInclude(sqlprojXml, newInclude);
  }
  const escaped = oldInclude.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lineRe = new RegExp(
    `(<Build\\b[^>]*\\bInclude\\s*=\\s*")${escaped}("\\s*/>)`,
    "i",
  );
  return sqlprojXml.replace(lineRe, `$1${newInclude}$2`);
}

export function renameTableIncludePath(
  currentInclude: string,
  newSchema: string,
  newTableName: string,
): string {
  const normalized = currentInclude.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  const folder =
    lastSlash === -1 ? "" : normalized.slice(0, lastSlash).replace(/\//g, "\\");
  return tableIncludePath(folder, newSchema, newTableName);
}

export function insertBuildInclude(sqlprojXml: string, include: string): string {
  if (buildIncludeExists(sqlprojXml, include)) {
    return sqlprojXml;
  }

  const buildLine = `    <Build Include="${include}" />`;
  const buildRe = /^\s*<Build\b[^>]*\bInclude\s*=/gm;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = buildRe.exec(sqlprojXml)) !== null) {
    lastMatch = match;
  }

  if (lastMatch) {
    const lineEnd = sqlprojXml.indexOf("\n", lastMatch.index);
    const insertAt = lineEnd === -1 ? sqlprojXml.length : lineEnd + 1;
    return `${sqlprojXml.slice(0, insertAt)}${buildLine}\n${sqlprojXml.slice(insertAt)}`;
  }

  const itemGroupClose = sqlprojXml.lastIndexOf("</ItemGroup>");
  if (itemGroupClose === -1) {
    throw new Error("Could not find an ItemGroup in the .sqlproj file.");
  }
  return `${sqlprojXml.slice(0, itemGroupClose)}${buildLine}\n  ${sqlprojXml.slice(itemGroupClose)}`;
}
