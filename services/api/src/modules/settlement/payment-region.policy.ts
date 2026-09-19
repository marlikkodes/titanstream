/** Local rails are limited to the East Africa launch region; all other users use USDT. */
export const EAST_AFRICA_COUNTRY_CODES = new Set(['UG', 'KE', 'TZ', 'RW']);

export function normalizePaymentCountry(country?: string): string {
  return String(country || 'GLOBAL').trim().toUpperCase() || 'GLOBAL';
}

export function supportsLocalPaymentRails(country?: string): boolean {
  return EAST_AFRICA_COUNTRY_CODES.has(normalizePaymentCountry(country));
}
