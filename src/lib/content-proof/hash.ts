/**
 * Canonical content hashing for proof-enabled content types — computed once at first
 * publish and never recomputed, so it stays a fixed target for the RFC
 * 3161 timestamp proof. Reproducible by a third party only because
 * title/slug/body/date-window are all locked after publish (see
 * lockedAfterPublish / lockTitleAndSlugAfterPublish).
 */

export interface CanonicalProofContent {
	title: string;
	slug: string;
	body: string;
	dateWindowStart: string | null;
	dateWindowEnd: string | null;
}

/** SHA-256 hex digest of the deterministic (sorted-key) JSON of the prediction's core content. */
export async function computeCanonicalHash(input: CanonicalProofContent): Promise<string> {
	const canonical = JSON.stringify(input, Object.keys(input).sort());
	const bytes = new TextEncoder().encode(canonical);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
