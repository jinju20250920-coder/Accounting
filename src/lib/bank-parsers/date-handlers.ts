import type { DateHandler } from './types';

/**
 * Parse ISO date strings: "2024-01-26", "2024-01-26 16:30:12"
 * Used by: ABC, CITIC, CMBC, Ping An, Industrial, CCB, Shanghai, BOCOM, Huaxia
 */
export class ISODateHandler implements DateHandler {
  parse(raw: any, timeRaw?: any): { date: string; time?: string } {
    const str = String(raw || '').trim();
    if (!str) return { date: '' };

    // If datetime combined (e.g. "2024-01-26 16:30:12")
    const match = str.match(/^(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2}:\d{2})?/);
    if (match) {
      return {
        date: match[1],
        time: timeRaw ? this.formatTime(String(timeRaw)) : (match[2] || undefined),
      };
    }

    return { date: str, time: timeRaw ? this.formatTime(String(timeRaw)) : undefined };
  }

  private formatTime(raw: string): string | undefined {
    const t = raw.trim();
    if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
    if (/^\d{2}:\d{2}$/.test(t)) return t + ':00';
    return undefined;
  }
}

/**
 * Parse Excel serial number dates: 45292 → "2024-01-01"
 * Used by: ICBC
 */
export class ExcelSerialDateHandler implements DateHandler {
  parse(raw: any, timeRaw?: any): { date: string; time?: string } {
    const num = Number(raw);
    if (isNaN(num) || num <= 0) return { date: '' };

    // Excel serial: days since 1900-01-01 (with the 1900 leap year bug offset)
    const ms = (num - 25569) * 86400000;
    const d = new Date(ms);
    const date = d.toISOString().slice(0, 10);

    return {
      date,
      time: timeRaw ? new ISODateHandler().parse('', timeRaw).time : undefined,
    };
  }
}

/**
 * Parse compact date strings: "20240102" → "2024-01-02"
 * Used by: BOC, SPDB
 */
export class CompactDateHandler implements DateHandler {
  parse(raw: any, timeRaw?: any): { date: string; time?: string } {
    const str = String(raw || '').trim();
    const match = str.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match) {
      return {
        date: `${match[1]}-${match[2]}-${match[3]}`,
        time: timeRaw ? this.parseCompactTime(String(timeRaw)) : undefined,
      };
    }

    // Fallback: try ISO
    return new ISODateHandler().parse(raw, timeRaw);
  }

  private parseCompactTime(raw: string): string | undefined {
    const t = raw.trim();
    const match = t.match(/^(\d{2})(\d{2})(\d{2})$/);
    if (match) return `${match[1]}:${match[2]}:${match[3]}`;
    // Already formatted?
    if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
    return undefined;
  }
}

/**
 * Parse custom date formats. Currently supports "yyyy-MM-dd-HHmm" → "yyyy-MM-dd HH:mm"
 * Used by: CZB
 */
export class CustomFormatDateHandler implements DateHandler {
  constructor(private pattern: string = 'yyyy-MM-dd-HHmm') {}

  parse(raw: any, timeRaw?: any): { date: string; time?: string } {
    const str = String(raw || '').trim();
    if (!str) return { date: '' };

    if (this.pattern === 'yyyy-MM-dd-HHmm') {
      // "2024-01-26-13:43" → date "2024-01-26", time "13:43:00"
      const match = str.match(/^(\d{4}-\d{2}-\d{2})[-\s](\d{2}:\d{2})/);
      if (match) {
        return { date: match[1], time: match[2] + ':00' };
      }
    }

    // Fallback to ISO
    return new ISODateHandler().parse(raw, timeRaw);
  }
}

/**
 * Get the appropriate date handler for a given format.
 */
export function getDateHandler(format: string, customPattern?: string): DateHandler {
  switch (format) {
    case 'excel_serial': return new ExcelSerialDateHandler();
    case 'compact': return new CompactDateHandler();
    case 'custom': return new CustomFormatDateHandler(customPattern);
    case 'iso':
    default: return new ISODateHandler();
  }
}
