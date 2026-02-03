// Source range → CodeMirror decoration mapping

export function locationToRange(
  doc: { line(n: number): { from: number; length: number }; lines: number },
  loc: [number, number, number, number]
): { from: number; to: number } | null {
  const [startRow, startCol, endRow, endCol] = loc;

  if (startRow < 1 || startRow > doc.lines) return null;
  if (endRow < 1 || endRow > doc.lines) return null;

  const startLine = doc.line(startRow);
  const endLine = doc.line(endRow);

  const from = startLine.from + Math.min(startCol - 1, startLine.length);
  const to = endLine.from + Math.min(endCol - 1, endLine.length);

  if (from >= to) return null;
  return { from, to };
}
