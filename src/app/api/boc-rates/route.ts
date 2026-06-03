import { NextRequest, NextResponse } from 'next/server';

const BOC_URL = 'https://www.boc.cn/sourcedb/whpj/';
const BOC_SEARCH_URL = 'https://srh.bankofchina.com/search/whpj/search_cn.jsp';
const BOC_CAPTCHA_URL = 'https://srh.bankofchina.com/search/whpj/CaptchaServlet.jsp';

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

// Reverse map: ISO code → Chinese name
const CODE_TO_NAME: Record<string, string> = {};
for (const [cn, code] of Object.entries(CURRENCY_NAME_MAP)) {
  CODE_TO_NAME[code] = cn;
}

interface BocRate {
  currencyCode: string;
  currencyName: string;
  middleRate: number;
  rateDate: string;
}

// Simple in-memory session store for captcha cookies+token
interface CaptchaSession {
  cookies: string;
  token: string;
  createdAt: number;
}

declare global {
  var bocCaptchaSessions: Map<string, CaptchaSession>;
}

if (!globalThis.bocCaptchaSessions) {
  globalThis.bocCaptchaSessions = new Map();
}
const captchaSessions = globalThis.bocCaptchaSessions;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

function decodeHtml(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('gbk').decode(buffer);
  }
}

/** Parse rates from the main BOC page (today's rates) */
function parseTodayRates(html: string, filterCodes?: Set<string>): BocRate[] {
  const rates: BocRate[] = [];
  const rowRegex = /<tr\s+data-currency=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const currencyName = rowMatch[1];
    const currencyCode = CURRENCY_NAME_MAP[currencyName];
    if (!currencyCode) continue;
    if (filterCodes && !filterCodes.has(currencyCode)) continue;

    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    cellRegex.lastIndex = 0;
    while ((cellMatch = cellRegex.exec(rowMatch[2])) !== null) {
      cells.push(stripHtml(cellMatch[1]));
    }
    if (cells.length < 6) continue;

    const rawRate = parseFloat(cells[5].replace(/,/g, ''));
    if (isNaN(rawRate) || rawRate <= 0) continue;

    const middleRate = Math.round((rawRate / 100) * 10000) / 10000;
    let rateDate = '';
    if (cells.length >= 7) {
      const datePart = cells[6].trim().split(/\s+/)[0];
      rateDate = datePart.replace(/\//g, '-');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rateDate)) {
      rateDate = new Date().toISOString().slice(0, 10);
    }
    rates.push({ currencyCode, currencyName, middleRate, rateDate });
  }
  return rates;
}

/** Parse rates from the BOC search results page (historical) */
function parseHistoryRates(html: string): BocRate[] {
  const rates: BocRate[] = [];
  // Search results use a table with <tr> containing <td> cells
  // Structure: currency, buy, cash buy, sell, cash sell, middle, date, time
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    cellRegex.lastIndex = 0;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(stripHtml(cellMatch[1]));
    }
    if (cells.length < 7) continue;

    const currencyName = cells[0].trim();
    const currencyCode = CURRENCY_NAME_MAP[currencyName];
    if (!currencyCode) continue;

    // cells[5] = 中行折算价
    const rawRate = parseFloat(cells[5].replace(/,/g, ''));
    if (isNaN(rawRate) || rawRate <= 0) continue;

    const middleRate = Math.round((rawRate / 100) * 10000) / 10000;

    // cells[6] = date like "2026.05.31 00:00:00"
    let rateDate = '';
    if (cells.length >= 7) {
      const datePart = cells[6].trim().split(/[\s/]+/);
      if (datePart.length >= 3) {
        rateDate = `${datePart[0]}-${datePart[1].padStart(2, '0')}-${datePart[2].padStart(2, '0')}`;
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rateDate)) continue;

    rates.push({ currencyCode, currencyName, middleRate, rateDate });
  }
  return rates;
}

// ========== GET: today's rates ==========
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const currenciesParam = searchParams.get('currencies');
    const filterCodes = currenciesParam
      ? new Set(currenciesParam.split(',').map(c => c.trim().toUpperCase()).filter(Boolean))
      : undefined;

    const response = await fetch(BOC_URL, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'zh-CN,zh;q=0.9' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `中国银行网站返回错误 (${response.status})` }, { status: 502 });
    }

    const html = decodeHtml(await response.arrayBuffer());
    const rates = parseTodayRates(html, filterCodes);

    if (rates.length === 0) {
      const msg = filterCodes
        ? `系统币种 ${[...filterCodes].join(', ')} 未在中国银行找到对应汇率`
        : '未能解析到汇率数据，页面结构可能已变更';
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    return NextResponse.json({ rates, fetchDate: rates[0]?.rateDate || new Date().toISOString().slice(0, 10), count: rates.length });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? '请求中国银行网站超时，请稍后重试'
      : '获取汇率数据失败，请检查网络连接';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ========== POST: historical rates with captcha ==========
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, currencies, captcha, sessionId } = body as {
      date: string;
      currencies: string[];
      captcha: string;
      sessionId: string;
    };

    if (!date || !currencies?.length || !captcha || !sessionId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // Look up captcha session
    const session = captchaSessions.get(sessionId);
    if (!session) {
      return NextResponse.json({ error: '验证码会话已过期，请重新获取' }, { status: 410 });
    }
    // Expire sessions after 5 minutes
    if (Date.now() - session.createdAt > 5 * 60 * 1000) {
      captchaSessions.delete(sessionId);
      return NextResponse.json({ error: '验证码已过期（超过5分钟），请重新获取' }, { status: 410 });
    }

    // Submit search for each currency
    const allRates: BocRate[] = [];
    const errors: string[] = [];

    for (const currencyCode of currencies) {
      const currencyName = CODE_TO_NAME[currencyCode];
      if (!currencyName) {
        errors.push(`${currencyCode} 未找到中文名称`);
        continue;
      }

      const params = new URLSearchParams({
        searchDate: date.replace(/-/g, ''),
        pjname: currencyName,
        head: 'head_620.js',
        bottom: 'bottom_591.js',
        first: '1',
        token: session.token,
        captcha,
      });

      const searchResponse = await fetch(BOC_SEARCH_URL, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': BOC_SEARCH_URL,
          'Cookie': session.cookies,
        },
        body: params.toString(),
        signal: AbortSignal.timeout(15000),
      });

      if (!searchResponse.ok) {
        errors.push(`${currencyCode} 查询失败 (${searchResponse.status})`);
        continue;
      }

      const html = decodeHtml(await searchResponse.arrayBuffer());

      // Check for captcha error
      if (html.includes('验证码过期') || html.includes('验证码错误')) {
        captchaSessions.delete(sessionId);
        return NextResponse.json({ error: '验证码错误或已过期，请重新获取验证码' }, { status: 422 });
      }

      const rates = parseHistoryRates(html);
      if (rates.length > 0) {
        allRates.push(...rates);
      } else {
        errors.push(`${currencyCode} (${currencyName}) 未找到 ${date} 的汇率`);
      }
    }

    captchaSessions.delete(sessionId);

    if (allRates.length === 0) {
      return NextResponse.json({ error: errors.join('；') || '未找到汇率数据' }, { status: 422 });
    }

    return NextResponse.json({ rates: allRates, fetchDate: date, count: allRates.length, warnings: errors.length ? errors : undefined });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? '请求中国银行网站超时，请稍后重试'
      : '获取历史汇率失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ========== Captcha session cleanup ==========
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of captchaSessions) {
    if (now - session.createdAt > 5 * 60 * 1000) captchaSessions.delete(id);
  }
}, 60_000);
