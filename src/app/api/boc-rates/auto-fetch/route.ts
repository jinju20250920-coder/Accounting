import { NextRequest, NextResponse } from 'next/server';

const BOC_URL = 'https://www.boc.cn/sourcedb/whpj/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const CURRENCY_NAME_MAP: Record<string, string> = {
  '美元': 'USD', '欧元': 'EUR', '日元': 'JPY', '英镑': 'GBP',
  '港币': 'HKD', '澳大利亚元': 'AUD', '加拿大元': 'CAD', '瑞士法郎': 'CHF',
  '新加坡元': 'SGD', '新西兰元': 'NZD', '韩国元': 'KRW', '泰国铢': 'THB',
  '林吉特': 'MYR', '卢布': 'RUB', '南非兰特': 'ZAR', '菲律宾比索': 'PHP',
  '印尼卢比': 'IDR', '巴西雷亚尔': 'BRL', '阿联酋迪拉姆': 'AED', '沙特里亚尔': 'SAR',
  '土耳其里拉': 'TRY', '波兰兹罗提': 'PLN', '印度卢比': 'INR', '越南盾': 'VND',
  '澳门元': 'MOP', '新台币': 'TWD', '丹麦克朗': 'DKK', '瑞典克朗': 'SEK',
  '挪威克朗': 'NOK', '文莱元': 'BND', '捷克克朗': 'CZK',
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

function decodeHtml(buffer: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { return new TextDecoder('gbk').decode(buffer); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currencies, accountSetId, targetDate } = body as {
      currencies: string[];
      accountSetId?: string;
      targetDate?: string;
    };

    if (!currencies?.length) {
      return NextResponse.json({ error: '未指定币种' }, { status: 400 });
    }

    const filterCodes = new Set(currencies.map(c => c.toUpperCase()));

    const response = await fetch(BOC_URL, {
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'zh-CN' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `中行网站错误 (${response.status})` }, { status: 502 });
    }

    const html = decodeHtml(await response.arrayBuffer());
    const rowRegex = /<tr\s+data-currency=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

    const rates: Array<{ currencyCode: string; middleRate: number; rateDate: string }> = [];
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const currencyName = rowMatch[1];
      const currencyCode = CURRENCY_NAME_MAP[currencyName];
      if (!currencyCode || !filterCodes.has(currencyCode)) continue;

      const cells: string[] = [];
      let cellMatch: RegExpExecArray | null;
      cellRegex.lastIndex = 0;
      while ((cellMatch = cellRegex.exec(rowMatch[2])) !== null) cells.push(stripHtml(cellMatch[1]));
      if (cells.length < 6) continue;

      const rawRate = parseFloat(cells[5].replace(/,/g, ''));
      if (isNaN(rawRate) || rawRate <= 0) continue;
      const middleRate = Math.round((rawRate / 100) * 10000) / 10000;

      let rateDate = '';
      if (cells.length >= 7) rateDate = cells[6].trim().split(/\s+/)[0].replace(/\//g, '-');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rateDate)) rateDate = new Date().toISOString().slice(0, 10);

      rates.push({ currencyCode, middleRate, rateDate });
    }

    const date = targetDate || new Date().toISOString().slice(0, 10);

    return NextResponse.json({
      success: true,
      rates,
      fetchDate: rates[0]?.rateDate || date,
      targetDate: date,
      count: rates.length,
    });
  } catch (error) {
    return NextResponse.json({ error: '自动获取失败' }, { status: 500 });
  }
}
