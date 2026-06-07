export interface PartnerDedupeInput {
  id?: string;
  code?: string;
  accountSetId?: string;
}

export function dedupePartnersForAccountSet<T extends PartnerDedupeInput>(partners: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const partner of partners) {
    const code = partner.code?.trim();
    const accountSetId = partner.accountSetId || '';
    const key = code ? `${accountSetId}::${code}` : `${accountSetId}::${partner.id || deduped.length}`;

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(partner);
  }

  return deduped;
}
