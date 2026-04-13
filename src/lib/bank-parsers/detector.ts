import * as XLSX from 'xlsx';
import type { BankParserConfig, DetectionResult } from './types';

/**
 * Auto-detect which bank format a file uses.
 * Returns scored results sorted by confidence (highest first).
 */
export async function detectBank(file: File, configs: BankParserConfig[]): Promise<DetectionResult[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];

  const rawData: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const previewRows = rawData.slice(0, 20);
  const allText = previewRows.flat().map(c => String(c || '')).join(' ');

  const results: DetectionResult[] = [];

  for (const config of configs) {
    let score = 0;

    // Check sheet keywords
    if (config.identifiers.sheetKeywords) {
      for (const kw of config.identifiers.sheetKeywords) {
        if (allText.includes(kw)) score += 2;
      }
    }

    // Check column keywords — scan likely header rows
    const maxCheckRow = Math.min(config.headerRows + 2, previewRows.length);
    let headerText = '';
    for (let r = 0; r < maxCheckRow; r++) {
      headerText += (previewRows[r] || []).join(' ') + ' ';
    }

    if (config.identifiers.columnKeywords) {
      for (const kw of config.identifiers.columnKeywords) {
        if (headerText.includes(kw)) score += 3;
      }
    }

    // Check column count
    const headerRow = previewRows[config.headerRows] || [];
    const colCount = headerRow.filter(c => String(c || '').trim()).length;
    if (config.identifiers.minColumns && colCount >= config.identifiers.minColumns) score += 1;
    if (config.identifiers.maxColumns && colCount <= config.identifiers.maxColumns) score += 1;

    if (score > 0) {
      results.push({ bankId: config.id, score, config });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Get the best detection result if confidence is high enough.
 * Returns null if no confident match found.
 */
export function getBestDetection(results: DetectionResult[]): DetectionResult | null {
  if (results.length === 0) return null;
  const best = results[0];
  if (best.score < 5) return null;
  if (results.length > 1 && best.score - results[1].score < 2) return null;
  return best;
}
