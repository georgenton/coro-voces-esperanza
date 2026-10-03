export type SourceDiffStatus = "NEW" | "MATCHING" | "MODIFIED" | "AMBIGUOUS" | "ABSENT" | "ALREADY_IMPORTED";

export type ComparableSourceRow = {
  id: string;
  sheetName: string;
  rowNumber: number;
  contentFingerprint: string;
  semanticKey: string | null;
  publicationCount?: number;
};

export type SourceRowDifference = {
  status: SourceDiffStatus;
  currentRowId: string | null;
  previousRowId: string | null;
  sheetName: string;
  rowNumber: number;
};

function groupBy(rows: ComparableSourceRow[], key: (row: ComparableSourceRow) => string | null) {
  const groups = new Map<string, ComparableSourceRow[]>();
  for (const row of rows) {
    const value = key(row);
    if (!value) continue;
    groups.set(value, [...(groups.get(value) ?? []), row]);
  }
  return groups;
}

export function compareSourceRows(current: ComparableSourceRow[], previous: ComparableSourceRow[]) {
  const currentByContent = groupBy(current, (row) => row.contentFingerprint);
  const previousByContent = groupBy(previous, (row) => row.contentFingerprint);
  const currentBySemantic = groupBy(current, (row) => row.semanticKey);
  const previousBySemantic = groupBy(previous, (row) => row.semanticKey);
  const relatedPreviousIds = new Set<string>();
  const differences: SourceRowDifference[] = [];

  for (const row of current) {
    const exactCurrent = currentByContent.get(row.contentFingerprint) ?? [];
    const exactPrevious = previousByContent.get(row.contentFingerprint) ?? [];
    if ((row.publicationCount ?? 0) > 0) {
      const semanticPrevious = row.semanticKey ? previousBySemantic.get(row.semanticKey) ?? [] : [];
      const related = exactPrevious.length ? exactPrevious : semanticPrevious;
      related.forEach((item) => relatedPreviousIds.add(item.id));
      differences.push({ status: "ALREADY_IMPORTED", currentRowId: row.id, previousRowId: related.length === 1 ? related[0].id : null, sheetName: row.sheetName, rowNumber: row.rowNumber });
      continue;
    }

    if (exactPrevious.length) {
      exactPrevious.forEach((item) => relatedPreviousIds.add(item.id));
      if (exactCurrent.length === 1 && exactPrevious.length === 1) {
        const previousRow = exactPrevious[0];
        differences.push({
          status: (previousRow.publicationCount ?? 0) > 0 ? "ALREADY_IMPORTED" : "MATCHING",
          currentRowId: row.id,
          previousRowId: previousRow.id,
          sheetName: row.sheetName,
          rowNumber: row.rowNumber,
        });
      } else {
        differences.push({ status: "AMBIGUOUS", currentRowId: row.id, previousRowId: null, sheetName: row.sheetName, rowNumber: row.rowNumber });
      }
      continue;
    }

    if (row.semanticKey) {
      const semanticCurrent = currentBySemantic.get(row.semanticKey) ?? [];
      const semanticPrevious = previousBySemantic.get(row.semanticKey) ?? [];
      if (semanticPrevious.length) {
        semanticPrevious.forEach((item) => relatedPreviousIds.add(item.id));
        if (semanticCurrent.length === 1 && semanticPrevious.length === 1) {
          differences.push({ status: "MODIFIED", currentRowId: row.id, previousRowId: semanticPrevious[0].id, sheetName: row.sheetName, rowNumber: row.rowNumber });
        } else {
          differences.push({ status: "AMBIGUOUS", currentRowId: row.id, previousRowId: null, sheetName: row.sheetName, rowNumber: row.rowNumber });
        }
        continue;
      }
    }

    differences.push({ status: "NEW", currentRowId: row.id, previousRowId: null, sheetName: row.sheetName, rowNumber: row.rowNumber });
  }

  for (const row of previous) {
    if (!relatedPreviousIds.has(row.id)) {
      differences.push({ status: "ABSENT", currentRowId: null, previousRowId: row.id, sheetName: row.sheetName, rowNumber: row.rowNumber });
    }
  }

  const counts = differences.reduce<Record<SourceDiffStatus, number>>((summary, item) => {
    summary[item.status] += 1;
    return summary;
  }, { NEW: 0, MATCHING: 0, MODIFIED: 0, AMBIGUOUS: 0, ABSENT: 0, ALREADY_IMPORTED: 0 });

  return { differences, counts };
}
