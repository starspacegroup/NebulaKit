/**
 * Google Merchant Center feed: the streamed RSS/TSV body, and the audit the
 * admin health panel shows. Rules and renderers are in
 * `packages/commerce/src/google-listing.ts` (pure); this module only feeds
 * them products a page at a time.
 *
 * Streaming matters for 2000+ products: one page of rows and one chunk of
 * text exist at a time, and a read error aborts the response (Google then
 * sees a failed fetch and keeps yesterday's feed) instead of delivering a
 * well-formed but silently short one.
 */
import type { D1Database } from '@cloudflare/workers-types';
import {
	RSS_FOOT,
	buildListing,
	eachFeedProduct,
	getGoogleListingSettings,
	renderRssHead,
	renderRssItem,
	renderTsvHeader,
	renderTsvRow,
	siteProblems,
	sortProblems,
	type GoogleListingSettings,
	type ListingContext,
	type ListingProblem
} from '@nebulakit/commerce';
import { site } from '$lib/site.config';
import { flatShippingFromEnv, taxRuleFromEnv, type CommerceEnv } from './site-info';

export type FeedFormat = 'rss' | 'tsv';

/** Everything {@link buildListing} needs, from the site's own config: never from the request. */
export async function listingContext(
	db: D1Database,
	env: CommerceEnv,
	nowMs: number = Date.now()
): Promise<ListingContext & { settings: GoogleListingSettings }> {
	return {
		siteUrl: site.url,
		nowMs,
		settings: await getGoogleListingSettings(db),
		flatShippingCents: flatShippingFromEnv(env)
	};
}

const CHUNK = 50;

/** The feed body. Products that Google would reject are left out; see {@link auditCatalog} for why. */
export function feedStream(
	format: FeedFormat,
	db: D1Database,
	ctx: ListingContext,
	options: { pageSize?: number } = {}
): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	const products = eachFeedProduct(db, { pageSize: options.pageSize });
	let started = false;
	let included = 0;
	let skipped = 0;
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			if (!started) {
				started = true;
				controller.enqueue(
					encoder.encode(
						format === 'rss'
							? renderRssHead({
									title: site.name,
									link: `${site.url}/`,
									description: site.description
								})
							: renderTsvHeader()
					)
				);
				return;
			}
			let text = '';
			for (let i = 0; i < CHUNK; i++) {
				const next = await products.next();
				if (next.done) {
					if (format === 'rss')
						text += `<!-- items: ${included}, left out: ${skipped} -->\n${RSS_FOOT}`;
					controller.enqueue(encoder.encode(text));
					controller.close();
					return;
				}
				const { item } = buildListing(next.value, ctx);
				if (!item) {
					skipped++;
					continue;
				}
				included++;
				text += format === 'rss' ? renderRssItem(item) : renderTsvRow(item);
			}
			controller.enqueue(encoder.encode(text));
		},
		async cancel() {
			await products.return(undefined);
		}
	});
}

export interface ProductProblem extends ListingProblem {
	productId: string;
	slug: string;
	name: string;
}

export interface CatalogAudit {
	/** Products read (capped). */
	checked: number;
	/** In the feed. */
	valid: number;
	/** Left out of the feed because of at least one error. */
	invalid: number;
	/** Products with only warnings; they are in the feed. */
	withWarnings: number;
	/** The first N problems, errors before warnings. */
	problems: ProductProblem[];
	/** Problems about the whole site (tax, shipping), not one product. */
	site: ListingProblem[];
	/** True when the read cap stopped the audit early. */
	capped: boolean;
}

/**
 * What Google would make of the catalog right now. Reads every active product
 * once, a page at a time, up to `max`; keeps only counts and the first
 * `maxProblems` problems, so memory does not grow with the catalog.
 */
export async function auditCatalog(
	db: D1Database,
	ctx: ListingContext,
	env: CommerceEnv,
	options: { maxProblems?: number; max?: number } = {}
): Promise<CatalogAudit> {
	const maxProblems = options.maxProblems ?? 50;
	const max = options.max ?? 10_000;
	const errors: ProductProblem[] = [];
	const warnings: ProductProblem[] = [];
	let checked = 0;
	let valid = 0;
	let invalid = 0;
	let withWarnings = 0;
	for await (const product of eachFeedProduct(db, { max })) {
		checked++;
		const { item, problems } = buildListing(product, ctx);
		if (!item) invalid++;
		else {
			valid++;
			if (problems.length) withWarnings++;
		}
		for (const p of problems) {
			const bucket = p.severity === 'error' ? errors : warnings;
			if (bucket.length < maxProblems)
				bucket.push({ ...p, productId: product.id, slug: product.slug, name: product.name });
		}
	}
	return {
		checked,
		valid,
		invalid,
		withWarnings,
		problems: [...errors, ...warnings].slice(0, maxProblems),
		site: sortProblems(siteProblems(ctx, taxRuleFromEnv(env), site.url)),
		capped: checked >= max
	};
}
