/**
 * Optional, default-OFF push of the catalog to Google Merchant Center through
 * the Merchant API (docs/GOOGLE_LISTINGS.md, "Merchant API sync"). The feed is
 * the supported, no-credentials path; this exists for shops that want changes
 * to reach Google in minutes instead of waiting for the next scheduled fetch.
 *
 *  - `fetch` is injected: no test and no code path here has ever called Google.
 *  - The service-account key is an encrypted KV record (secret-store.ts), never
 *    a D1 value, never returned by a page or API, never logged.
 *  - The access token is minted per run from a JWT signed with WebCrypto
 *    (RS256, https://developers.google.com/identity/protocols/oauth2/service-account)
 *    and kept only in memory.
 *  - Work is bounded: one scan page and at most `batch` writes per run, with a
 *    cursor, so a large catalog syncs over several ticks.
 *
 * Endpoint shapes come from Google's reference pages fetched 2026-11-25
 * (productInputs.insert, productInputs.delete, ProductInput). Nothing here has
 * been exercised against the real API: see the "could not verify" list in the
 * docs.
 */
import type { D1Database } from '@cloudflare/workers-types';
import {
	buildListing,
	eachFeedProduct,
	getCommerceSetting,
	getSyncRows,
	listStaleSynced,
	markSynced,
	setCommerceSetting,
	toMerchantApiAttributes,
	unmarkSynced,
	type ListingContext,
	type Product
} from '@nebulakit/commerce';
import { readRecordWithSecret, sealRecordSecret, type SecretField } from './secret-store';

export const MERCHANT_API_BASE = 'https://merchantapi.googleapis.com/products/v1';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const MERCHANT_SCOPE = 'https://www.googleapis.com/auth/content';

const SETTINGS_KEY = 'google_merchant';
export const SERVICE_ACCOUNT_KV_KEY = 'google_merchant:service_account';
export const SERVICE_ACCOUNT_SPEC: SecretField = {
	field: 'privateKey',
	hintField: 'privateKeyLast4',
	purpose: 'google-merchant',
	recordId: 'service_account'
};

/** Most writes (insert + delete) one run makes. */
export const SYNC_BATCH = 100;
/** Products one run looks at to find changes. */
export const SYNC_SCAN = 250;

export interface MerchantRun {
	at: string;
	sent: number;
	deleted: number;
	failed: number;
	unchanged: number;
	error: string | null;
}

export interface MerchantSettings {
	/** Master switch. Default OFF. */
	enabled: boolean;
	/** Merchant Center account id, digits only. */
	accountId: string | null;
	/** An API data source id (digits) in that account. */
	dataSourceId: string | null;
	/** Target market label, e.g. "US". Max 20 of A-Z 0-9 - _. */
	feedLabel: string | null;
	/** Where the scan resumes (the last product id handled), '' to start over. */
	cursor: string;
	lastRun: MerchantRun | null;
}

export const DEFAULT_MERCHANT_SETTINGS: MerchantSettings = {
	enabled: false,
	accountId: null,
	dataSourceId: null,
	feedLabel: null,
	cursor: '',
	lastRun: null
};

export function parseMerchantSettings(raw: unknown): MerchantSettings {
	let data: unknown = raw;
	if (typeof raw === 'string') {
		try {
			data = JSON.parse(raw);
		} catch {
			return { ...DEFAULT_MERCHANT_SETTINGS };
		}
	}
	if (typeof data !== 'object' || data === null || Array.isArray(data))
		return { ...DEFAULT_MERCHANT_SETTINGS };
	const d = data as Record<string, unknown>;
	const digits = (v: unknown) => (typeof v === 'string' && /^\d{1,20}$/.test(v) ? v : null);
	const lastRun = d.lastRun as Partial<MerchantRun> | null | undefined;
	return {
		enabled: d.enabled === true,
		accountId: digits(d.accountId),
		dataSourceId: digits(d.dataSourceId),
		feedLabel:
			typeof d.feedLabel === 'string' && /^[A-Z0-9_-]{1,20}$/.test(d.feedLabel)
				? d.feedLabel
				: null,
		cursor: typeof d.cursor === 'string' ? d.cursor.slice(0, 64) : '',
		lastRun:
			lastRun && typeof lastRun.at === 'string'
				? {
						at: lastRun.at,
						sent: Number(lastRun.sent) || 0,
						deleted: Number(lastRun.deleted) || 0,
						failed: Number(lastRun.failed) || 0,
						unchanged: Number(lastRun.unchanged) || 0,
						error: typeof lastRun.error === 'string' ? lastRun.error.slice(0, 300) : null
					}
				: null
	};
}

export async function getMerchantSettings(db: D1Database): Promise<MerchantSettings> {
	return parseMerchantSettings(await getCommerceSetting(db, SETTINGS_KEY));
}

export async function saveMerchantSettings(db: D1Database, s: MerchantSettings): Promise<void> {
	await setCommerceSetting(db, SETTINGS_KEY, JSON.stringify(s));
}

/** What an admin may change; the cursor and last run belong to the job. */
export function validateMerchantInput(
	body: Record<string, unknown>
):
	| {
			ok: true;
			value: Pick<MerchantSettings, 'enabled' | 'accountId' | 'dataSourceId' | 'feedLabel'>;
	  }
	| { ok: false; errors: string[] } {
	const errors: string[] = [];
	const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
	const accountId = text(body.accountId);
	const dataSourceId = text(body.dataSourceId);
	const feedLabel = text(body.feedLabel).toUpperCase();
	if (accountId && !/^\d{1,20}$/.test(accountId))
		errors.push('Merchant account id is digits only.');
	if (dataSourceId && !/^\d{1,20}$/.test(dataSourceId))
		errors.push('Data source id is digits only.');
	if (feedLabel && !/^[A-Z0-9_-]{1,20}$/.test(feedLabel))
		errors.push('Feed label is up to 20 letters, digits, dashes or underscores.');
	const enabled = body.enabled === true;
	if (enabled && !(accountId && dataSourceId && feedLabel))
		errors.push('Account id, data source id and feed label are needed before the sync can be on.');
	return errors.length
		? { ok: false, errors }
		: {
				ok: true,
				value: {
					enabled,
					accountId: accountId || null,
					dataSourceId: dataSourceId || null,
					feedLabel: feedLabel || null
				}
			};
}

// ---------------------------------------------------------------- credentials

export interface ServiceAccount {
	clientEmail: string;
	privateKey: string;
}

/**
 * Read a downloaded service-account key file. Only the two fields the JWT flow
 * needs are kept; everything else in the file is discarded unread.
 */
export function parseServiceAccountJson(
	text: string
): { ok: true; value: ServiceAccount } | { ok: false; error: string } {
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		return { ok: false, error: 'That is not a JSON key file.' };
	}
	const j = json as Record<string, unknown>;
	const email = j?.client_email;
	const key = j?.private_key;
	if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(email))
		return { ok: false, error: 'The key file has no client_email.' };
	if (
		typeof key !== 'string' ||
		!/-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----/.test(key)
	)
		return { ok: false, error: 'The key file has no PKCS#8 private_key.' };
	return { ok: true, value: { clientEmail: email, privateKey: key } };
}

/** Store the key sealed in KV. The private key never touches D1. */
export async function saveServiceAccount(
	platform: App.Platform | undefined,
	account: ServiceAccount
): Promise<void> {
	const sealed = await sealRecordSecret(
		platform,
		{ clientEmail: account.clientEmail },
		SERVICE_ACCOUNT_SPEC,
		account.privateKey
	);
	await platform!.env.KV.put(SERVICE_ACCOUNT_KV_KEY, JSON.stringify(sealed));
}

export async function loadServiceAccount(
	platform: App.Platform | undefined
): Promise<ServiceAccount | null> {
	const read = await readRecordWithSecret<{ clientEmail: string; privateKey?: string }>(
		platform,
		SERVICE_ACCOUNT_KV_KEY,
		SERVICE_ACCOUNT_SPEC
	);
	if (!read?.record.privateKey || !read.record.clientEmail) return null;
	return { clientEmail: read.record.clientEmail, privateKey: read.record.privateKey };
}

/** Public facts for the admin page: that a key exists and whose it is. Never the key. */
export async function serviceAccountStatus(
	platform: App.Platform | undefined
): Promise<{ configured: boolean; clientEmail: string | null }> {
	const raw = await platform?.env?.KV?.get(SERVICE_ACCOUNT_KV_KEY);
	if (!raw) return { configured: false, clientEmail: null };
	try {
		const r = JSON.parse(raw) as { clientEmail?: string };
		return { configured: true, clientEmail: r.clientEmail ?? null };
	} catch {
		return { configured: false, clientEmail: null };
	}
}

// ------------------------------------------------------------------------ JWT

const b64url = (bytes: Uint8Array) => {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const textB64url = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

function pemToDer(pem: string): ArrayBuffer {
	const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
	const raw = atob(body);
	const bytes = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
	return bytes.buffer;
}

/** The signed JWT assertion for the service-account flow. `nowSec` is injected. */
export async function signServiceAccountJwt(
	account: ServiceAccount,
	nowSec: number,
	scope: string = MERCHANT_SCOPE
): Promise<string> {
	const header = textB64url({ alg: 'RS256', typ: 'JWT' });
	const claims = textB64url({
		iss: account.clientEmail,
		scope,
		aud: TOKEN_URL,
		iat: nowSec,
		exp: nowSec + 3600
	});
	const key = await crypto.subtle.importKey(
		'pkcs8',
		pemToDer(account.privateKey),
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		key,
		new TextEncoder().encode(`${header}.${claims}`)
	);
	return `${header}.${claims}.${b64url(new Uint8Array(signature))}`;
}

// --------------------------------------------------------------------- client

export class MerchantApiError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** A short, secret-free description of a failed response. */
async function failure(what: string, res: Response): Promise<MerchantApiError> {
	let detail = '';
	try {
		const body = (await res.json()) as { error?: { message?: string; status?: string } };
		detail = body?.error?.message ?? body?.error?.status ?? '';
	} catch {
		// not JSON: the status line is enough
	}
	return new MerchantApiError(
		`${what} failed: HTTP ${res.status}${detail ? ` ${detail.slice(0, 160)}` : ''}`,
		res.status
	);
}

export class MerchantClient {
	private token: string | null = null;

	constructor(
		private readonly opts: {
			fetch: FetchLike;
			account: ServiceAccount;
			accountId: string;
			dataSourceId: string;
			feedLabel: string;
			contentLanguage: string;
			nowSec: () => number;
		}
	) {}

	private async accessToken(): Promise<string> {
		if (this.token) return this.token;
		const assertion = await signServiceAccountJwt(this.opts.account, this.opts.nowSec());
		const res = await this.opts.fetch(TOKEN_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
				assertion
			})
		});
		if (!res.ok) throw await failure('Google sign-in', res);
		const json = (await res.json()) as { access_token?: string };
		if (!json.access_token) throw new MerchantApiError('Google sign-in returned no token', 502);
		this.token = json.access_token;
		return this.token;
	}

	private get dataSource() {
		return `accounts/${this.opts.accountId}/dataSources/${this.opts.dataSourceId}`;
	}

	/** `POST /products/v1/accounts/{id}/productInputs:insert?dataSource=...` */
	async insert(offerId: string, productAttributes: Record<string, unknown>): Promise<void> {
		const url =
			`${MERCHANT_API_BASE}/accounts/${this.opts.accountId}/productInputs:insert` +
			`?dataSource=${encodeURIComponent(this.dataSource)}`;
		const res = await this.opts.fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${await this.accessToken()}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				offerId,
				contentLanguage: this.opts.contentLanguage,
				feedLabel: this.opts.feedLabel,
				productAttributes
			})
		});
		if (!res.ok) throw await failure('Product insert', res);
	}

	/** `DELETE /products/v1/accounts/{id}/productInputs/{base64url(lang~label~offer)}?dataSource=...` */
	async remove(offerId: string): Promise<void> {
		const id = b64url(
			new TextEncoder().encode(`${this.opts.contentLanguage}~${this.opts.feedLabel}~${offerId}`)
		);
		const url =
			`${MERCHANT_API_BASE}/accounts/${this.opts.accountId}/productInputs/${id}` +
			`?dataSource=${encodeURIComponent(this.dataSource)}`;
		const res = await this.opts.fetch(url, {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${await this.accessToken()}` }
		});
		// Already gone is the state we wanted.
		if (!res.ok && res.status !== 404) throw await failure('Product delete', res);
	}
}

// ------------------------------------------------------------------------ run

async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type SyncOutcome =
	| { skipped: 'disabled' | 'not-configured' | 'no-credentials' }
	| ({ skipped?: undefined } & MerchantRun);

/**
 * One bounded sync pass: send what changed since last time, delete what
 * should no longer be listed. Safe to repeat: a product is marked synced only
 * after Google accepted exactly that payload.
 */
export async function runMerchantSync(deps: {
	db: D1Database;
	platform: App.Platform | undefined;
	fetch: FetchLike;
	ctx: ListingContext;
	nowMs: number;
	signal?: AbortSignal;
	batch?: number;
	scan?: number;
}): Promise<SyncOutcome> {
	const settings = await getMerchantSettings(deps.db);
	if (!settings.enabled) return { skipped: 'disabled' };
	if (!settings.accountId || !settings.dataSourceId || !settings.feedLabel)
		return { skipped: 'not-configured' };
	const account = await loadServiceAccount(deps.platform);
	if (!account) return { skipped: 'no-credentials' };

	const batch = deps.batch ?? SYNC_BATCH;
	const scan = deps.scan ?? SYNC_SCAN;
	const client = new MerchantClient({
		fetch: deps.fetch,
		account,
		accountId: settings.accountId,
		dataSourceId: settings.dataSourceId,
		feedLabel: settings.feedLabel,
		contentLanguage: deps.ctx.settings.contentLanguage,
		nowSec: () => Math.floor(deps.nowMs / 1000)
	});
	const run: MerchantRun = {
		at: new Date(deps.nowMs).toISOString(),
		sent: 0,
		deleted: 0,
		failed: 0,
		unchanged: 0,
		error: null
	};
	let cursor = settings.cursor;
	let writes = 0;
	const accepted: { productId: string; offerId: string; contentHash: string }[] = [];
	const stop = () => deps.signal?.aborted === true;

	try {
		// 1. Deletions first: a product that must not be listed is the costlier mistake.
		for (const row of await listStaleSynced(deps.db, batch)) {
			if (writes >= batch || stop()) break;
			await client.remove(row.offerId);
			await unmarkSynced(deps.db, [row.productId]);
			run.deleted++;
			writes++;
		}

		// 2. Changes: one page from the cursor, never the whole catalog in one run.
		const page: Product[] = [];
		for await (const product of eachFeedProduct(deps.db, {
			pageSize: scan,
			max: scan,
			afterId: cursor
		}))
			page.push(product);
		const known = await getSyncRows(
			deps.db,
			page.map((p) => p.id)
		);
		let handled = cursor;
		for (const product of page) {
			if (writes >= batch || stop()) break;
			handled = product.id;
			const { item } = buildListing(product, deps.ctx);
			if (!item) {
				// Rejected by our own rules: make sure Google does not keep an older copy.
				if (known.has(product.id)) {
					await client.remove(product.id);
					await unmarkSynced(deps.db, [product.id]);
					run.deleted++;
					writes++;
				}
				continue;
			}
			const attributes = toMerchantApiAttributes(item);
			const hash = await sha256Hex(JSON.stringify({ id: product.id, attributes }));
			if (known.get(product.id)?.contentHash === hash) {
				run.unchanged++;
				continue;
			}
			try {
				await client.insert(product.id, attributes);
				accepted.push({ productId: product.id, offerId: product.id, contentHash: hash });
				run.sent++;
			} catch (err) {
				// A rejected product is skipped this round; a rate limit or outage ends the run.
				if (
					err instanceof MerchantApiError &&
					err.status >= 400 &&
					err.status < 500 &&
					err.status !== 429 &&
					err.status !== 401 &&
					err.status !== 403
				) {
					run.failed++;
					run.error = err.message;
				} else throw err;
			}
			writes++;
		}
		// Resume after the last product handled; a page that ended the catalog starts over.
		cursor = handled === page[page.length - 1]?.id && page.length < scan ? '' : handled;
		if (page.length === 0) cursor = '';
	} catch (err) {
		run.error = err instanceof Error ? err.message.slice(0, 300) : 'unknown error';
		run.failed++;
	}
	// What Google accepted is recorded even when a later call failed.
	await markSynced(deps.db, accepted);
	await saveMerchantSettings(deps.db, { ...settings, cursor, lastRun: run });
	return run;
}
