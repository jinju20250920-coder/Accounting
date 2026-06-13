export function normalizeAssetDate(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed.substring(0, 10) : undefined;
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().substring(0, 10);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString().substring(0, 10) : undefined;
  }

  return undefined;
}

export function getAssetDatePeriod(value: unknown): string | undefined {
  return normalizeAssetDate(value)?.substring(0, 7);
}
