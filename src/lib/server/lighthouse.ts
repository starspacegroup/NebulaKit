/**
 * Lighthouse scores for this app's own public pages.
 *
 * **Why PageSpeed Insights and not Lighthouse itself.** Lighthouse drives a
 * real Chrome. A Cloudflare Worker has no browser and could not afford the CPU
 * if it did, and this project deploys to Cloudflare Pages, which — unlike
 * Workers — has no Cron Triggers to run one on. PSI runs Lighthouse on
 * Google's infrastructure and hands back the whole report over plain HTTP, so
 * the audit becomes a `fetch`. No browser, no CI, no build step, and it works
 * for an app generated from this template on the day it is deployed.
 *
 * The cost of that choice, stated plainly: PSI can only reach a public URL. It
 * cannot audit localhost, a preview deployment behind Access, or anything
 * before the first deploy. `site.url` has to be real for this to return
 * anything, and until it is, the admin page says so rather than showing zeros.
 *
 * Scheduling is the existing `/api/cron/*` convention — a shared bearer secret
 * and any external scheduler. There is no cron in a Pages deployment; see
 * `src/routes/api/cron/lighthouse/+server.ts`.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { SITEMAP_ROUTES } from '$lib/agent-discovery';
import { site } from '$lib/site.config';

/** PSI's public endpoint. Works without a key at a low rate limit. */
const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/** The four categories, as PSI names them. */
export const LIGHTHOUSE_CATEGORIES = [
	'performance',
	'accessibility',
	'best-practices',
	'seo'
] as const;

export type LighthouseCategory = (typeof LIGHTHOUSE_CATEGORIES)[number];

/** PSI runs one form factor per call; mobile is the one Google ranks on. */
export type Strategy = 'mobile' | 'desktop';

export function isStrategy(value: unknown): value is Strategy {
	return value === 'mobile' || value === 'desktop';
}

/**
 * An audit counts as a finding below this score.
 *
 * 0.9 is Lighthouse's own boundary between "good" (green) and everything else,
 * so a finding here is exactly what the reader would see flagged in the report.
 */
const FAILING_BELOW = 0.9;

export interface LighthouseFinding {
	category: LighthouseCategory;
	auditId: string;
	title: string;
	description: string | null;
	score: number | null;
	displayValue: string | null;
}

export interface LighthouseAudit {
	path: string;
	strategy: Strategy;
	fetchedAt: string;
	performance: number | null;
	accessibility: number | null;
	bestPractices: number | null;
	seo: number | null;
	lighthouseVersion: string | null;
	error: string | null;
	findings: LighthouseFinding[];
}

/**
 * The paths to audit: whatever the sitemap already calls public.
 *
 * Derived rather than listed, so a page added to SITEMAP_ROUTES is audited
 * without anyone remembering to add it here — and a page deliberately kept out
 * of the sitemap is not quietly sent to Google either.
 */
export function auditablePaths(): string[] {
	return SITEMAP_ROUTES.map((route) => route.path);
}

/** 0-1 from PSI, rounded to the 0-100 everyone actually talks in. NULL stays NULL. */
function toScore(value: unknown): number | null {
	return typeof value === 'number' ? Math.round(value * 100) : null;
}

/**
 * Pull the scores and the failing audits out of a PSI response.
 *
 * Exported so the parsing can be tested against a recorded payload without a
 * network call — this is the part that breaks when Google changes a field, and
 * it is the part a live test would be slowest and flakiest at covering.
 */
export function parsePsiResponse(
	payload: unknown
): Omit<LighthouseAudit, 'path' | 'strategy' | 'fetchedAt'> {
	const result = (payload as { lighthouseResult?: Record<string, unknown> })?.lighthouseResult;
	if (!result) {
		return {
			performance: null,
			accessibility: null,
			bestPractices: null,
			seo: null,
			lighthouseVersion: null,
			error: 'PageSpeed Insights returned no lighthouseResult',
			findings: []
		};
	}

	const categories = (result.categories ?? {}) as Record<string, Record<string, unknown>>;
	const audits = (result.audits ?? {}) as Record<string, Record<string, unknown>>;
	const findings: LighthouseFinding[] = [];

	for (const category of LIGHTHOUSE_CATEGORIES) {
		const refs = (categories[category]?.auditRefs ?? []) as { id: string }[];
		for (const ref of refs) {
			const audit = audits[ref.id];
			if (!audit) continue;
			const score = audit.score;
			// `null` is Lighthouse's marker for informative, manual and
			// not-applicable audits. They are not passes and they are not
			// failures, and listing them would bury the real findings.
			if (typeof score !== 'number' || score >= FAILING_BELOW) continue;
			findings.push({
				category,
				auditId: ref.id,
				title: String(audit.title ?? ref.id),
				description: audit.description ? String(audit.description) : null,
				score: toScore(score),
				displayValue: audit.displayValue ? String(audit.displayValue) : null
			});
		}
	}

	return {
		performance: toScore(categories.performance?.score),
		accessibility: toScore(categories.accessibility?.score),
		bestPractices: toScore(categories['best-practices']?.score),
		seo: toScore(categories.seo?.score),
		lighthouseVersion: result.lighthouseVersion ? String(result.lighthouseVersion) : null,
		error: null,
		findings
	};
}

/** The PSI URL for one page. */
export function psiUrl(pageUrl: string, strategy: Strategy, apiKey?: string): string {
	const params = new URLSearchParams({ url: pageUrl, strategy });
	for (const category of LIGHTHOUSE_CATEGORIES) params.append('category', category);
	if (apiKey) params.set('key', apiKey);
	return `${PSI_ENDPOINT}?${params}`;
}

/**
 * Audit one path.
 *
 * Never throws. A run that fails records the reason against the path and
 * returns like any other, because "PSI could not reach /contact" is something
 * the admin page has to be able to show — and because one unreachable page
 * must not abandon the other ten in the same sweep.
 */
export async function auditPath(
	path: string,
	strategy: Strategy,
	options: { apiKey?: string; origin?: string; fetcher?: typeof fetch } = {}
): Promise<LighthouseAudit> {
	const origin = (options.origin ?? site.url).replace(/\/$/, '');
	const fetcher = options.fetcher ?? fetch;
	const fetchedAt = new Date().toISOString();
	const base = { path, strategy, fetchedAt };

	try {
		const response = await fetcher(psiUrl(`${origin}${path}`, strategy, options.apiKey));
		if (!response.ok) {
			return {
				...base,
				performance: null,
				accessibility: null,
				bestPractices: null,
				seo: null,
				lighthouseVersion: null,
				// The status is the useful half: 429 means the keyless rate limit,
				// which is a different fix from a 400 on an unreachable URL.
				error: `PageSpeed Insights returned ${response.status}`,
				findings: []
			};
		}
		return { ...base, ...parsePsiResponse(await response.json()) };
	} catch (cause) {
		return {
			...base,
			performance: null,
			accessibility: null,
			bestPractices: null,
			seo: null,
			lighthouseVersion: null,
			error: cause instanceof Error ? cause.message : 'PageSpeed Insights request failed',
			findings: []
		};
	}
}

/** Write one audit, replacing whatever that path and strategy had before. */
export async function saveAudit(db: D1Database, audit: LighthouseAudit): Promise<void> {
	const statements = [
		db
			.prepare(
				`INSERT INTO lighthouse_audits
				 (path, strategy, fetched_at, performance, accessibility, best_practices, seo,
				  lighthouse_version, error)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT(path, strategy) DO UPDATE SET
				   fetched_at = excluded.fetched_at,
				   performance = excluded.performance,
				   accessibility = excluded.accessibility,
				   best_practices = excluded.best_practices,
				   seo = excluded.seo,
				   lighthouse_version = excluded.lighthouse_version,
				   error = excluded.error`
			)
			.bind(
				audit.path,
				audit.strategy,
				audit.fetchedAt,
				audit.performance,
				audit.accessibility,
				audit.bestPractices,
				audit.seo,
				audit.lighthouseVersion,
				audit.error
			),
		// Replaced wholesale rather than merged: an audit that stopped failing
		// has to disappear, and a diff would leave fixed problems on the page.
		db
			.prepare(`DELETE FROM lighthouse_findings WHERE path = ? AND strategy = ?`)
			.bind(audit.path, audit.strategy),
		...audit.findings.map((finding) =>
			db
				.prepare(
					`INSERT INTO lighthouse_findings
					 (path, strategy, category, audit_id, title, description, score, display_value)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
					 ON CONFLICT(path, strategy, audit_id) DO UPDATE SET
					   category = excluded.category,
					   title = excluded.title,
					   description = excluded.description,
					   score = excluded.score,
					   display_value = excluded.display_value`
				)
				.bind(
					audit.path,
					audit.strategy,
					finding.category,
					finding.auditId,
					finding.title,
					finding.description,
					finding.score,
					finding.displayValue
				)
		)
	];

	await db.batch(statements);
}

/**
 * Audit every public path and store the results.
 *
 * Sequential on purpose. PSI is rate limited hard without a key — a burst of
 * eleven parallel requests is the reliable way to get 429s on all of them, and
 * this runs on a schedule where finishing slowly beats failing quickly.
 */
export async function runLighthouseSweep(
	db: D1Database,
	options: { apiKey?: string; origin?: string; strategy?: Strategy; fetcher?: typeof fetch } = {}
): Promise<{ audited: number; failed: number }> {
	const strategy = options.strategy ?? 'mobile';
	let failed = 0;

	const paths = auditablePaths();
	for (const path of paths) {
		const audit = await auditPath(path, strategy, options);
		if (audit.error) failed += 1;
		await saveAudit(db, audit);
	}

	return { audited: paths.length, failed };
}

export interface StoredAudit {
	path: string;
	strategy: string;
	fetched_at: string;
	performance: number | null;
	accessibility: number | null;
	best_practices: number | null;
	seo: number | null;
	lighthouse_version: string | null;
	error: string | null;
}

export interface StoredFinding {
	path: string;
	strategy: string;
	category: string;
	audit_id: string;
	title: string;
	description: string | null;
	score: number | null;
	display_value: string | null;
}

/** Every stored audit, worst score first so the problem is the first row. */
export async function listAudits(db: D1Database): Promise<StoredAudit[]> {
	const { results } = await db
		.prepare(
			`SELECT path, strategy, fetched_at, performance, accessibility, best_practices, seo,
			        lighthouse_version, error
			 FROM lighthouse_audits
			 ORDER BY
			   -- A failed run sorts above a bad score: it is the more urgent thing
			   -- and its scores are NULL, which would otherwise sort last.
			   CASE WHEN error IS NOT NULL THEN 0 ELSE 1 END,
			   MIN(
			     COALESCE(performance, 100), COALESCE(accessibility, 100),
			     COALESCE(best_practices, 100), COALESCE(seo, 100)
			   ) ASC,
			   path ASC`
		)
		.all<StoredAudit>();
	return results ?? [];
}

/** Every stored finding, worst first. */
export async function listFindings(db: D1Database): Promise<StoredFinding[]> {
	const { results } = await db
		.prepare(
			`SELECT path, strategy, category, audit_id, title, description, score, display_value
			 FROM lighthouse_findings
			 ORDER BY COALESCE(score, 0) ASC, path ASC, audit_id ASC`
		)
		.all<StoredFinding>();
	return results ?? [];
}
