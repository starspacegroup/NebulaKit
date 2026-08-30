import type { KVNamespace } from '@cloudflare/workers-types';
import { GA4_MEASUREMENT_ID, type AnalyticsConfig, parseMeasurementId } from '$lib/utils/analytics';

/** Single KV key, alongside `auth_config:*` and `reset_route_disabled`. This is
 *  configuration, not a secret and not a counter, so it needs neither R2 nor a
 *  migration. */
export const ANALYTICS_CONFIG_KEY = 'analytics_config';

/**
 * Read the saved GA connection. Fails soft, like the admin dashboard's own KV
 * reads: a missing binding, an unreachable KV, or a row written by an older
 * version resolves to "not connected" rather than breaking every page load,
 * because the root layout calls this on every request.
 */
export async function readAnalyticsConfig(
	kv: KVNamespace | undefined | null
): Promise<AnalyticsConfig | null> {
	if (!kv) return null;

	let raw: string | null;
	try {
		raw = await kv.get(ANALYTICS_CONFIG_KEY);
	} catch (err) {
		console.error('Failed to read analytics config from KV:', err);
		return null;
	}
	if (!raw) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}

	const candidate = parsed as Partial<AnalyticsConfig> | null;
	if (!candidate || typeof candidate.measurementId !== 'string') return null;
	// Validate on the way out too. The write path is owner-only, but a value
	// edited straight into KV must not reach a `<script src>` unchecked.
	if (!GA4_MEASUREMENT_ID.test(candidate.measurementId)) return null;

	return {
		provider: 'ga4',
		measurementId: candidate.measurementId,
		enabled: candidate.enabled !== false,
		updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : ''
	};
}

export async function writeAnalyticsConfig(
	kv: KVNamespace,
	config: AnalyticsConfig
): Promise<void> {
	await kv.put(ANALYTICS_CONFIG_KEY, JSON.stringify(config));
}

export async function clearAnalyticsConfig(kv: KVNamespace): Promise<void> {
	await kv.delete(ANALYTICS_CONFIG_KEY);
}

/** Build the config to store from admin input. Rejects the same strings the
 *  admin form rejects, because both go through `parseMeasurementId`. */
export function buildAnalyticsConfig(
	input: string,
	enabled: boolean,
	now: Date = new Date()
): { ok: true; config: AnalyticsConfig } | { ok: false; reason: string } {
	const parsed = parseMeasurementId(input);
	if (!parsed.ok) return parsed;

	return {
		ok: true,
		config: {
			provider: 'ga4',
			measurementId: parsed.measurementId,
			enabled,
			updatedAt: now.toISOString()
		}
	};
}

/** The ID the browser tag should use, or `null` when GA is unconnected or
 *  switched off. This is what the root layout hands to the client. */
export async function getActiveMeasurementId(
	kv: KVNamespace | undefined | null
): Promise<string | null> {
	const config = await readAnalyticsConfig(kv);
	return config?.enabled ? config.measurementId : null;
}
