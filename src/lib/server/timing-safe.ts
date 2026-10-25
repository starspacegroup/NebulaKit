/**
 * Compare two secrets without stopping at the first difference.
 *
 * Use it for tokens, cron secrets and anything else an attacker can submit
 * repeatedly. A length mismatch returns early, which reveals only the length.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return mismatch === 0;
}
