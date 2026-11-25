import { error, fail } from '@sveltejs/kit';
import {
	getFeedFetch,
	getGoogleListingSettings,
	saveGoogleListingSettings,
	type GoogleListingSettings
} from '@nebulakit/commerce';
import { requireOwner, requirePermission } from '$lib/server/auth-guards';
import { auditCatalog, listingContext } from '$lib/server/google-feed';
import {
	getMerchantSettings,
	parseServiceAccountJson,
	saveMerchantSettings,
	saveServiceAccount,
	serviceAccountStatus,
	validateMerchantInput,
	SERVICE_ACCOUNT_KV_KEY
} from '$lib/server/google-merchant';
import { dollarsToCents, centsToDollars } from '$lib/shop/money-input';
import type { CommerceEnv } from '$lib/server/site-info';
import { site } from '$lib/site.config';
import type { Actions, PageServerLoad } from './$types';

/** How many problems the health panel lists. */
export const PROBLEM_LIMIT = 40;

function database(platform: App.Platform | undefined) {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	return db;
}

/** The settings as the form shows them. */
function settingsToForm(s: GoogleListingSettings) {
	const r = s.returns;
	return {
		defaultBrand: s.defaultBrand ?? '',
		contentLanguage: s.contentLanguage,
		shipCountries: s.shipCountries.join(', '),
		handlingDaysMin: s.handlingDaysMin == null ? '' : String(s.handlingDaysMin),
		handlingDaysMax: s.handlingDaysMax == null ? '' : String(s.handlingDaysMax),
		transitDaysMin: s.transitDaysMin == null ? '' : String(s.transitDaysMin),
		transitDaysMax: s.transitDaysMax == null ? '' : String(s.transitDaysMax),
		returnCategory: r?.category ?? '',
		returnDays: r?.days == null ? '' : String(r.days),
		returnFees: r?.fees ?? 'customer',
		returnFeeAmount: r?.shippingFeeCents ? centsToDollars(r.shippingFeeCents) : '',
		returnMethods: r?.methods ?? [],
		returnCountries: r?.countries.join(', ') ?? ''
	};
}
export type SettingsForm = ReturnType<typeof settingsToForm>;

const list = (v: string) =>
	v
		.split(/[\s,]+/)
		.map((x) => x.trim().toUpperCase())
		.filter(Boolean);
const whole = (v: string) =>
	v.trim() === '' ? null : /^\d{1,3}$/.test(v.trim()) ? Number(v) : NaN;

export const load: PageServerLoad = async ({ locals, platform }) => {
	requirePermission(locals, 'shop');
	const db = database(platform);
	const env = platform?.env as unknown as CommerceEnv;
	const ctx = await listingContext(db, env);
	const [audit, fetched, merchant, key] = await Promise.all([
		auditCatalog(db, ctx, env, { maxProblems: PROBLEM_LIMIT }),
		getFeedFetch(db),
		getMerchantSettings(db),
		serviceAccountStatus(platform)
	]);
	return {
		audit,
		feedUrls: {
			rss: `${site.url}/feeds/google-products.xml`,
			tsv: `${site.url}/feeds/google-products.tsv`
		},
		// UTC ISO instant; the page prints it with a fixed formatter, never the viewer's locale.
		lastFetched: fetched,
		settings: settingsToForm(ctx.settings),
		merchant: {
			enabled: merchant.enabled,
			accountId: merchant.accountId ?? '',
			dataSourceId: merchant.dataSourceId ?? '',
			feedLabel: merchant.feedLabel ?? '',
			lastRun: merchant.lastRun
		},
		serviceAccount: key,
		isOwner: Boolean(locals.user?.isOwner || locals.user?.isSuperAdmin),
		problemLimit: PROBLEM_LIMIT
	};
};

export const actions: Actions = {
	/** Return policy, shipping, default brand. Same permission as editing a product. */
	settings: async ({ locals, platform, request }) => {
		requirePermission(locals, 'shop');
		const db = database(platform);
		const f = await request.formData();
		const text = (k: string) => String(f.get(k) ?? '').trim();
		const category = text('returnCategory');
		const feeCents = text('returnFeeAmount') ? dollarsToCents(text('returnFeeAmount')) : null;
		const body = {
			defaultBrand: text('defaultBrand') || null,
			contentLanguage: text('contentLanguage').toLowerCase() || 'en',
			shipCountries: list(text('shipCountries')),
			handlingDaysMin: whole(text('handlingDaysMin')),
			handlingDaysMax: whole(text('handlingDaysMax')),
			transitDaysMin: whole(text('transitDaysMin')),
			transitDaysMax: whole(text('transitDaysMax')),
			returns: category
				? {
						category,
						days: whole(text('returnDays')),
						fees: text('returnFees') || 'customer',
						shippingFeeCents: feeCents,
						methods: f.getAll('returnMethods').map(String),
						countries: list(text('returnCountries'))
					}
				: null
		};
		const problems: string[] = [];
		if (text('returnFeeAmount') && feeCents === null)
			problems.push('Return shipping fee must be dollars and cents, like 5.00.');
		for (const [key, value] of Object.entries(body)) {
			if (typeof value === 'number' && Number.isNaN(value))
				problems.push(`${key} must be a whole number of days.`);
		}
		if (problems.length) return fail(400, { action: 'settings', problems });
		// NaN would serialise to null; reject it explicitly instead.
		const checked = await saveGoogleListingSettings(db, body);
		if (!checked.ok) return fail(400, { action: 'settings', problems: checked.errors });
		return { action: 'settings', message: 'Google listing settings saved.' };
	},

	/** The Merchant API sync switch and ids. Owner only: it spends the shop's Google credentials. */
	sync: async ({ locals, platform, request }) => {
		requireOwner(locals);
		const db = database(platform);
		const f = await request.formData();
		const checked = validateMerchantInput({
			enabled: f.get('enabled') === 'on',
			accountId: f.get('accountId'),
			dataSourceId: f.get('dataSourceId'),
			feedLabel: f.get('feedLabel')
		});
		if (!checked.ok) return fail(400, { action: 'sync', problems: checked.errors });
		if (checked.value.enabled && !(await serviceAccountStatus(platform)).configured)
			return fail(400, {
				action: 'sync',
				problems: ['Store a service-account key before turning the sync on.']
			});
		const current = await getMerchantSettings(db);
		await saveMerchantSettings(db, {
			...current,
			...checked.value,
			// Changing the target starts the scan over.
			cursor: ''
		});
		return {
			action: 'sync',
			message: checked.value.enabled ? 'Merchant API sync is on.' : 'Merchant API sync is off.'
		};
	},

	/** Store the downloaded service-account key, sealed in KV. Owner only. */
	key: async ({ locals, platform, request }) => {
		requireOwner(locals);
		if (!platform?.env?.KV) throw error(503, 'Key storage is not available');
		const f = await request.formData();
		const parsed = parseServiceAccountJson(String(f.get('serviceAccountJson') ?? ''));
		if (!parsed.ok) return fail(400, { action: 'key', problems: [parsed.error] });
		await saveServiceAccount(platform, parsed.value);
		return { action: 'key', message: `Stored the key for ${parsed.value.clientEmail}.` };
	},

	clearKey: async ({ locals, platform }) => {
		requireOwner(locals);
		const db = database(platform);
		await platform?.env?.KV?.delete(SERVICE_ACCOUNT_KV_KEY);
		const current = await getMerchantSettings(db);
		await saveMerchantSettings(db, { ...current, enabled: false, cursor: '' });
		return { action: 'clearKey', message: 'Key removed and the sync turned off.' };
	}
};
