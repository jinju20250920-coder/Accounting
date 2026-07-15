import { describe, it, expect } from 'vitest';
import { CompactDateHandler, ISODateHandler, ExcelSerialDateHandler, getDateHandler } from './date-handlers';

describe('CompactDateHandler', () => {
  const h = new CompactDateHandler();

  it('纯 8 位紧凑日期 → YYYY-MM-DD', () => {
    expect(h.parse('20260405')).toEqual({ date: '2026-04-05', time: undefined });
  });

  it('紧凑日期 + 时间连写（建行邦洁格式）→ 拆出日期和时间', () => {
    // 这是本次修复的核心场景：旧版正则 $ 锚定会整体不匹配
    expect(h.parse('20260405 08:56:26')).toEqual({ date: '2026-04-05', time: '08:56:26' });
  });

  it('紧凑日期 + 时分（无秒）→ 补齐为 HH:mm:ss', () => {
    expect(h.parse('20260405 08:56')).toEqual({ date: '2026-04-05', time: '08:56:00' });
  });

  it('独立时间列优先于日期串内嵌时间', () => {
    expect(h.parse('20260405 08:56:26', '09:00:00')).toEqual({ date: '2026-04-05', time: '09:00:00' });
  });

  it('空值 → 空日期', () => {
    expect(h.parse('')).toEqual({ date: '' });
    expect(h.parse(null as unknown as string)).toEqual({ date: '' });
  });

  it('非紧凑格式 → 回退 ISO', () => {
    expect(h.parse('2026-04-05').date).toBe('2026-04-05');
  });
});

describe('ISODateHandler', () => {
  const h = new ISODateHandler();
  it('ISO 日期', () => {
    expect(h.parse('2026-04-18')).toEqual({ date: '2026-04-18', time: undefined });
  });
  it('ISO 日期时间', () => {
    expect(h.parse('2026-04-18 09:53:45')).toEqual({ date: '2026-04-18', time: '09:53:45' });
  });
});

describe('ExcelSerialDateHandler', () => {
  it('45292 → 2024-01-01', () => {
    expect(new ExcelSerialDateHandler().parse(45292).date).toBe('2024-01-01');
  });
});

describe('getDateHandler', () => {
  it('compact 类型返回 CompactDateHandler', () => {
    expect(getDateHandler('compact')).toBeInstanceOf(CompactDateHandler);
  });
  it('iso 类型返回 ISODateHandler', () => {
    expect(getDateHandler('iso')).toBeInstanceOf(ISODateHandler);
  });
});
