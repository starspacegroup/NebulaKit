/**
 * Run the public checks behind the trust badges (docs/TRUST_BADGES.md) and
 * return them as `TrustCheck` rows. Each check uses a free public API. A check
 * that cannot be measured comes back `passed: false` with the reason in
 * `detail`; it never passes by default.
 */
import type { TrustCheck } from './trust-badges';

export interface ExternalCheck extends TrustCheck {
	/** What was measured, in plain words, for a log or an admin view. */
	detail: string;
}

type Fetcher = typeof fetch;

/** Letter grades, best first. Used by Observatory and SSL Labs. */
const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'T', 'M'];

/** True when `grade` is `min` or better. An unknown grade is never good enough. */
export function gradeAtLeast(grade: string, min: string): boolean {
	const g = GRADES.indexOf(grade);
	const m = GRADES.indexOf(min);
	return g !== -1 && m !== -1 && g <= m;
}

const day = (now: Date) => now.toISOString().slice(0, 10);

function failed(label: string, reportUrl: string, now: Date, why: unknown): ExternalCheck {
	const detail = `could not measure: ${why instanceof Error ? why.message : String(why)}`;
	return { label, reportUrl, measuredOn: day(now), passed: false, detail };
}

export async function observatoryCheck(
	host: string,
	now: Date = new Date(),
	f: Fetcher = fetch,
	minGrade = 'B'
): Promise<ExternalCheck> {
	const reportUrl = `https://developer.mozilla.org/en-US/observatory/analyze?host=${host}`;
	try {
		const res = await f(
			`https://observatory-api.mdn.mozilla.net/api/v2/scan?host=${encodeURIComponent(host)}`,
			{ method: 'POST' }
		);
		const r = (await res.json()) as {
			grade?: string;
			score?: number;
			tests_passed?: number;
			tests_quantity?: number;
			error?: string | null;
		};
		if (!res.ok || r.error || !r.grade) throw new Error(r.error ?? `HTTP ${res.status}`);
		return {
			label: `Mozilla HTTP Observatory ${r.grade}`,
			reportUrl,
			measuredOn: day(now),
			passed: gradeAtLeast(r.grade, minGrade),
			detail: `${r.score} points, ${r.tests_passed} of ${r.tests_quantity} tests`
		};
	} catch (e) {
		return failed('Mozilla HTTP Observatory', reportUrl, now, e);
	}
}

export interface SslLabsOptions {
	minGrade?: string;
	pollMs?: number;
	maxPolls?: number;
	sleep?: (ms: number) => Promise<void>;
}

export async function sslLabsCheck(
	host: string,
	now: Date = new Date(),
	f: Fetcher = fetch,
	{
		minGrade = 'A',
		pollMs = 10_000,
		maxPolls = 30,
		sleep = (ms) => new Promise((r) => setTimeout(r, ms))
	}: SslLabsOptions = {}
): Promise<ExternalCheck> {
	const reportUrl = `https://www.ssllabs.com/ssltest/analyze.html?d=${host}`;
	const api = `https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(host)}&fromCache=on&maxAge=720`;
	try {
		for (let i = 0; i < maxPolls; i++) {
			const r = (await (await f(api)).json()) as {
				status?: string;
				statusMessage?: string;
				endpoints?: { grade?: string }[];
			};
			if (r.status === 'READY') {
				const grades = (r.endpoints ?? []).map((e) => e.grade).filter((g): g is string => !!g);
				if (!grades.length) throw new Error('no graded endpoints');
				// The worst endpoint sets the grade a visitor can rely on.
				const worst = grades.reduce((a, b) => (GRADES.indexOf(a) >= GRADES.indexOf(b) ? a : b));
				return {
					label: `SSL Labs ${worst}`,
					reportUrl,
					measuredOn: day(now),
					passed: gradeAtLeast(worst, minGrade),
					detail: `${grades.length} endpoint(s), worst grade ${worst}`
				};
			}
			if (r.status === 'ERROR') throw new Error(r.statusMessage ?? 'SSL Labs error');
			await sleep(pollMs);
		}
		throw new Error('timed out waiting for the scan');
	} catch (e) {
		return failed('SSL Labs', reportUrl, now, e);
	}
}

export async function hstsPreloadCheck(
	host: string,
	now: Date = new Date(),
	f: Fetcher = fetch
): Promise<ExternalCheck> {
	const reportUrl = `https://hstspreload.org/?domain=${host}`;
	try {
		const r = (await (
			await f(`https://hstspreload.org/api/v2/status?domain=${encodeURIComponent(host)}`)
		).json()) as { status?: string };
		return {
			label: 'HSTS preload',
			reportUrl,
			measuredOn: day(now),
			passed: r.status === 'preloaded',
			detail: `status: ${r.status ?? 'unknown'}`
		};
	} catch (e) {
		return failed('HSTS preload', reportUrl, now, e);
	}
}

/** RFC 9116: a Contact line, and an Expires date still in the future. */
export async function securityTxtCheck(
	host: string,
	now: Date = new Date(),
	f: Fetcher = fetch
): Promise<ExternalCheck> {
	const reportUrl = `https://${host}/.well-known/security.txt`;
	try {
		const res = await f(reportUrl);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const text = await res.text();
		const hasContact = /^contact:\s*\S+/im.test(text);
		const expires = /^expires:\s*(\S+)/im.exec(text)?.[1];
		const fresh = !!expires && Date.parse(expires) > now.getTime();
		return {
			label: 'security.txt',
			reportUrl,
			measuredOn: day(now),
			passed: hasContact && fresh,
			detail: `${hasContact ? 'has' : 'no'} Contact, ${
				expires ? (fresh ? 'expires ' + expires : 'expired ' + expires) : 'no Expires'
			}`
		};
	} catch (e) {
		return failed('security.txt', reportUrl, now, e);
	}
}

const PSI_CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;

/**
 * Lighthouse through the PageSpeed Insights API, phone and desktop. The keyless
 * quota is small and often spent; pass a key (PSI_API_KEY) for reliable runs.
 */
export async function pageSpeedChecks(
	url: string,
	now: Date = new Date(),
	f: Fetcher = fetch,
	{ key, minScore = 90 }: { key?: string; minScore?: number } = {}
): Promise<ExternalCheck[]> {
	const out: ExternalCheck[] = [];
	for (const strategy of ['mobile', 'desktop'] as const) {
		const where = strategy === 'mobile' ? 'on a phone' : 'on a desktop';
		const label = `Lighthouse, ${where}`;
		const reportUrl = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}${
			strategy === 'desktop' ? '&form_factor=desktop' : ''
		}`;
		try {
			const q = new URLSearchParams({ url, strategy });
			for (const c of PSI_CATEGORIES) q.append('category', c);
			if (key) q.set('key', key);
			const res = await f(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`);
			const r = (await res.json()) as {
				error?: { message?: string };
				lighthouseResult?: { categories?: Record<string, { score: number | null }> };
			};
			const cats = r.lighthouseResult?.categories;
			if (!res.ok || !cats)
				throw new Error(r.error?.message?.split('.')[0] ?? `HTTP ${res.status}`);
			const scores = PSI_CATEGORIES.map((c) => Math.round((cats[c]?.score ?? 0) * 100));
			out.push({
				label,
				reportUrl,
				measuredOn: day(now),
				passed: scores.every((s) => s >= minScore),
				detail: `performance ${scores[0]}, accessibility ${scores[1]}, best practices ${scores[2]}, SEO ${scores[3]}`
			});
		} catch (e) {
			out.push(failed(label, reportUrl, now, e));
		}
	}
	return out;
}

export async function runExternalChecks(
	host: string,
	opts: { now?: Date; f?: Fetcher; psiKey?: string; ssl?: SslLabsOptions } = {}
): Promise<ExternalCheck[]> {
	const now = opts.now ?? new Date();
	const f = opts.f ?? fetch;
	const [observatory, ssl, hsts, txt, psi] = await Promise.all([
		observatoryCheck(host, now, f),
		sslLabsCheck(host, now, f, opts.ssl),
		hstsPreloadCheck(host, now, f),
		securityTxtCheck(host, now, f),
		pageSpeedChecks(`https://${host}/`, now, f, { key: opts.psiKey })
	]);
	return [ssl, ...psi, observatory, txt, hsts];
}
