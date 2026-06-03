import { NextResponse } from 'next/server';

const BOC_CAPTCHA_URL = 'https://srh.bankofchina.com/search/whpj/CaptchaServlet.jsp';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

declare global {
  var bocCaptchaSessions: Map<string, { cookies: string; token: string; createdAt: number }>;
}

if (!globalThis.bocCaptchaSessions) {
  globalThis.bocCaptchaSessions = new Map();
}

export async function GET() {
  try {
    const response = await fetch(BOC_CAPTCHA_URL, {
      headers: {
        'User-Agent': UA,
        'Accept': '*/*',
        'Referer': 'https://srh.bankofchina.com/search/whpj/search_cn.jsp',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: '获取验证码失败' }, { status: 502 });
    }

    const token = response.headers.get('Token') || '';

    const rawCookie = response.headers.get('set-cookie') || '';
    const cookies = rawCookie
      .split(/,(?=\s*\w+=)/)
      .map(c => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');

    // BOC returns the captcha image as a base64 text body (Content-Type: text/plain)
    const text = await response.text();
    const image = `data:image/png;base64,${text.trim()}`;

    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    globalThis.bocCaptchaSessions.set(sessionId, {
      cookies,
      token,
      createdAt: Date.now(),
    });

    return NextResponse.json({ image, sessionId });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? '获取验证码超时'
      : '获取验证码失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
