/**
 * Trust badges that a visitor can check: each one links to a live public
 * report and carries the date it was measured. See docs/TRUST_BADGES.md.
 *
 * Rules enforced here:
 * - A badge shows only when its measured result passed. A failing check is
 *   something to fix, not something to display.
 * - A badge older than `maxAgeDays` is hidden, so the page never shows a stale
 *   claim. Re-measure and update the data instead.
 * - Every badge needs a report URL (https) and a measured date.
 */
export interface TrustCheck {
	/** Short label, e.g. "SSL Labs A+". */
	label: string;
	/** Public report a visitor can open to check the claim. Must be https. */
	reportUrl: string;
	/** ISO date (YYYY-MM-DD) the result was measured. */
	measuredOn: string;
	/** True only when the measured result meets the bar you set for showing it. */
	passed: boolean;
}

export const DEFAULT_MAX_AGE_DAYS = 90;

function parseDay(iso: string): number | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
	const t = Date.parse(`${iso}T00:00:00Z`);
	return Number.isNaN(t) ? null : t;
}

function isHttps(url: string): boolean {
	try {
		return new URL(url).protocol === 'https:';
	} catch {
		return false;
	}
}

/** The checks that may be shown now: passed, https report, valid date, not stale, not in the future. */
export function visibleTrustChecks(
	checks: TrustCheck[],
	now: Date = new Date(),
	maxAgeDays: number = DEFAULT_MAX_AGE_DAYS
): TrustCheck[] {
	const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	return checks.filter((c) => {
		if (!c.passed || !c.label.trim() || !isHttps(c.reportUrl)) return false;
		const day = parseDay(c.measuredOn);
		if (day === null || day > today) return false;
		return (today - day) / 86_400_000 <= maxAgeDays;
	});
}

/** The checks that need attention: failed, or measured too long ago. Use in admin views or CI. */
export function trustChecksNeedingWork(
	checks: TrustCheck[],
	now: Date = new Date(),
	maxAgeDays: number = DEFAULT_MAX_AGE_DAYS
): TrustCheck[] {
	const shown = new Set(visibleTrustChecks(checks, now, maxAgeDays));
	return checks.filter((c) => !shown.has(c));
}
