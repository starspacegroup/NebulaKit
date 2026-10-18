/**
 * What a site reports about itself to the API (`GET /api/v1/site`), and the
 * owner's update choices.
 *
 * Ammoura reads this to know which template and package versions a site
 * runs, and which feature updates its owner opted in to. Security updates
 * (`@nebulakit/security`) have no switch here on purpose: they are forced.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { COMMERCE_VERSION, NO_TAX, type TaxRule } from '@nebulakit/commerce';
import { BUILDER_VERSION } from '@nebulakit/builder';
import { SECURITY_VERSION } from '@nebulakit/security';
import { site } from '$lib/site.config';
import rootPackage from '../../../package.json';

export const TEMPLATE_VERSION: string = rootPackage.version;

export const PACKAGE_VERSIONS = {
	'@nebulakit/commerce': COMMERCE_VERSION,
	'@nebulakit/builder': BUILDER_VERSION,
	'@nebulakit/security': SECURITY_VERSION
} as const;

export interface UpdatePreferences {
	/** Take every feature release without asking. Off by default: nobody's site changes under them. */
	autoApplyFeatures: boolean;
	/** Release ids the owner accepted one at a time. */
	optedIn: string[];
	updatedAt: string | null;
}

const RELEASE_ID = /^[A-Za-z0-9@/._-]{1,100}$/;

export async function getUpdatePreferences(db: D1Database): Promise<UpdatePreferences> {
	const row = await db
		.prepare('SELECT * FROM site_update_preferences WHERE id = 1')
		.first<Record<string, unknown>>();
	if (!row) return { autoApplyFeatures: false, optedIn: [], updatedAt: null };
	let optedIn: string[] = [];
	try {
		const parsed = JSON.parse(String(row.opted_in));
		if (Array.isArray(parsed)) optedIn = parsed.filter((id) => typeof id === 'string');
	} catch {
		// a corrupt list reads as "nothing opted in" — the safe direction
	}
	return {
		autoApplyFeatures: Number(row.auto_apply_features) === 1,
		optedIn,
		updatedAt: row.updated_at as string
	};
}

export function validateUpdatePreferences(
	body: unknown
): { ok: true; value: Omit<UpdatePreferences, 'updatedAt'> } | { ok: false; errors: string[] } {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return { ok: false, errors: ['Body must be an object'] };
	}
	const b = body as Record<string, unknown>;
	const errors: string[] = [];
	if (typeof b.autoApplyFeatures !== 'boolean')
		errors.push('autoApplyFeatures must be true or false');
	if (
		!Array.isArray(b.optedIn) ||
		b.optedIn.length > 500 ||
		!b.optedIn.every((id) => typeof id === 'string' && RELEASE_ID.test(id))
	) {
		errors.push('optedIn must be a list of release ids');
	}
	if (errors.length) return { ok: false, errors };
	return {
		ok: true,
		value: {
			autoApplyFeatures: b.autoApplyFeatures as boolean,
			optedIn: [...new Set(b.optedIn as string[])]
		}
	};
}

export async function saveUpdatePreferences(
	db: D1Database,
	prefs: Omit<UpdatePreferences, 'updatedAt'>
): Promise<UpdatePreferences> {
	await db
		.prepare(
			`INSERT INTO site_update_preferences (id, auto_apply_features, opted_in, updated_at)
			 VALUES (1, ?, ?, datetime('now'))
			 ON CONFLICT(id) DO UPDATE SET auto_apply_features = excluded.auto_apply_features,
			   opted_in = excluded.opted_in, updated_at = excluded.updated_at`
		)
		.bind(prefs.autoApplyFeatures ? 1 : 0, JSON.stringify(prefs.optedIn))
		.run();
	return getUpdatePreferences(db);
}

export async function describeSite(db: D1Database) {
	return {
		name: site.name,
		slug: site.slug,
		url: site.url,
		template: { name: 'nebulakit', version: TEMPLATE_VERSION },
		packages: PACKAGE_VERSIONS,
		updates: await getUpdatePreferences(db),
		api: { version: 'v1', openapi: '/api/v1/openapi.json' }
	};
}

/**
 * The shop's checkout settings, from the environment the site is deployed
 * with (Ammoura sets these per site). Tax and shipping are never taken from
 * the request.
 */
export interface CommerceEnv {
	COMMERCE_TAX_RATE_PERCENT?: string;
	COMMERCE_PRICES_INCLUDE_TAX?: string;
	COMMERCE_FLAT_SHIPPING_CENTS?: string;
	STRIPE_SECRET_KEY?: string;
	STRIPE_WEBHOOK_SECRET?: string;
}

export function taxRuleFromEnv(env: CommerceEnv): TaxRule {
	const rate = Number(env.COMMERCE_TAX_RATE_PERCENT);
	if (!env.COMMERCE_TAX_RATE_PERCENT || !Number.isFinite(rate) || rate <= 0) return NO_TAX;
	return {
		enabled: true,
		ratePercent: rate,
		pricesIncludeTax: env.COMMERCE_PRICES_INCLUDE_TAX === 'true'
	};
}

export function flatShippingFromEnv(env: CommerceEnv): number {
	const cents = Number(env.COMMERCE_FLAT_SHIPPING_CENTS);
	return Number.isSafeInteger(cents) && cents > 0 ? cents : 0;
}
