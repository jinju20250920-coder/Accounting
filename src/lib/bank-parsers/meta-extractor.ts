import type { BankAccountInfo, BankParserConfig } from './types';

/**
 * Extract BankAccountInfo from metadata rows (rows 0 to headerRows-1).
 */
export function extractMeta(rawData: string[][], config: BankParserConfig): BankAccountInfo {
  const info: BankAccountInfo = {
    bankName: '',
    accountName: '',
    accountNumber: '',
    branch: '',
    currency: '',
  };

  if (!config.metaExtract) return info;

  for (const rule of config.metaExtract) {
    const row = rawData[rule.row];
    if (!row) continue;

    let value = '';

    if (rule.col !== undefined) {
      // Direct column index
      value = String(row[rule.col] || '').trim();
      // Strip label prefix (e.g. "账号: 6222..." → "6222...")
      value = stripLabel(value, rule.keyword);
    } else if (rule.keyword) {
      // Auto-detect: scan row for keyword, take next cell's value
      value = findByKeyword(row, rule.keyword);
    }

    if (value) {
      info[rule.field] = value;
    }
  }

  return info;
}

function stripLabel(value: string, keyword?: string): string {
  if (!keyword) return value;
  // Remove patterns like "账号:" or "账号："
  const idx = value.indexOf(keyword);
  if (idx >= 0) {
    const after = value.slice(idx + keyword.length).replace(/^[:：\s]+/, '');
    if (after) return after;
  }
  return value;
}

function findByKeyword(row: string[], keyword: string): string {
  for (let i = 0; i < row.length; i++) {
    const cell = String(row[i] || '').trim();
    if (cell.includes(keyword)) {
      // Return the next cell's value, or the remainder after the keyword in this cell
      if (i + 1 < row.length) {
        const next = String(row[i + 1] || '').trim();
        if (next) return next;
      }
      // Keyword and value in same cell: "账号: 6222..."
      return stripLabel(cell, keyword);
    }
  }
  return '';
}
