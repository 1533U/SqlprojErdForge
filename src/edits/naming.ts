/** Shared table-key naming helpers for edits and the webview. */

export function tableShortName(tableKey: string): string {
  const dot = tableKey.indexOf(".");
  return dot === -1 ? tableKey : tableKey.slice(dot + 1);
}

export function suggestForeignKeyName(fromTableKey: string, toTableKey: string): string {
  return `FK_${tableShortName(fromTableKey)}_${tableShortName(toTableKey)}`;
}
