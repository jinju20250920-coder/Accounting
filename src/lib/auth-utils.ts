/**
 * Auth utilities - 密码哈希和验证
 * 使用 Web Crypto API SHA-256
 */

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string, salt?: string): Promise<string> {
  const s = salt || crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const data = new TextEncoder().encode(`${s}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = arrayBufferToHex(hashBuffer);
  return `sha256:${s}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'sha256') return false;
  const salt = parts[1];
  const computed = await hashPassword(password, salt);
  return computed === storedHash;
}
