/** Dollars as an admin types them, and back. Pure, so forms and server code share it. */
const DOLLARS = /^\$?\s*(\d{1,7})(?:\.(\d{1,2}))?$/;

/**
 * Dollars as an admin types them ("12", "12.5", "$12.50") to whole cents.
 * Null for anything else: money never goes through a float.
 */
export function dollarsToCents(input: string): number | null {
	const match = DOLLARS.exec(input.trim());
	if (!match) return null;
	return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || 0);
}

export function centsToDollars(cents: number): string {
	return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
