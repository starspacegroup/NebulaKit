import { fillMonthlySeries, type MonthCount } from '$lib/utils/stats-timeseries';
import {
	listCountries,
	listDailyViews,
	listDimension,
	listHourlyViews,
	listReferrers,
	listTopContent,
	listViewsByPath,
	utcDay,
	utcHourKey
} from '$lib/utils/page-views';
import { getUsage, projectUsage } from '$lib/utils/usage';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * The stats summary behind the admin dashboard (docs/ADMIN_STATS.md).
 *
 * One assembly, two readers: `/admin` renders it for a signed-in admin, and
 * `/api/stats/summary` hands the same object to an external dashboard holding
 * the owner-issued stats token. Keeping the assembly here means the two can
 * never disagree about what "views this week" is.
 *
 * Fail-soft rules, worth preserving if you extend it:
 * 1. Every optional query carries `.catch(() => [])` and each panel degrades as
 *    a unit — a database missing a migration loses one panel, not the summary.
 * 2. The clock is server-authoritative: `trafficNowHour` is computed once here.
 * 3. Only the core user counts may throw; the caller turns that into a 500.
 */

export const TRAFFIC_WINDOWS = [1, 7, 30, 90] as const;
export type TrafficWindow = (typeof TRAFFIC_WINDOWS)[number];
/** The "1 day" window is plotted as this many trailing hourly buckets. */
export const TRAFFIC_HOURS = 24;

/** A window from a query string, or the 30-day default for anything else. */
export function parseTrafficWindow(raw: string | null | undefined): TrafficWindow {
	const requested = Number(raw);
	return (TRAFFIC_WINDOWS as readonly number[]).includes(requested)
		? (requested as TrafficWindow)
		: 30;
}

export async function loadStatsSummary(
	db: D1Database,
	trafficWindow: TrafficWindow,
	now: Date = new Date()
) {
	const [userCount, adminCount, contentCount, contactCount, chatCount, contentBreakdown] =
		await Promise.all([
			db.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>(),
			db
				.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1')
				.first<{ count: number }>(),
			db
				.prepare('SELECT COUNT(*) as count FROM content_items')
				.first<{ count: number }>()
				.catch(() => null),
			db
				.prepare('SELECT COUNT(*) as count FROM contact_form_submissions')
				.first<{ count: number }>()
				.catch(() => null),
			db
				.prepare('SELECT COUNT(*) as count FROM chat_messages')
				.first<{ count: number }>()
				.catch(() => null),
			db
				.prepare(
					`SELECT
					   SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
					   SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
					   SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived
					 FROM content_items`
				)
				.first<{ draft: number | null; published: number | null; archived: number | null }>()
				.catch(() => null)
		]);

	// Monthly creation counts. strftime returns NULL for any unparseable
	// timestamp; fillMonthlySeries drops those and gap-fills the rest.
	const [usersByMonthRes, contentByMonthRes] = await Promise.all([
		db
			.prepare(
				`SELECT strftime('%Y-%m', created_at) as ym, COUNT(*) as count
				 FROM users GROUP BY ym ORDER BY ym`
			)
			.all<MonthCount>()
			.catch(() => null),
		db
			.prepare(
				`SELECT strftime('%Y-%m', created_at) as ym, COUNT(*) as count
				 FROM content_items GROUP BY ym ORDER BY ym`
			)
			.all<MonthCount>()
			.catch(() => null)
	]);

	const sinceDay = utcDay(new Date(now.getTime() - trafficWindow * 24 * 60 * 60 * 1000));
	// The 1-day window is plotted hourly (a two-bar day chart is useless), so
	// it needs the trailing-24h counters as well. Wider windows skip the query.
	const sinceHour = utcHourKey(new Date(now.getTime() - (TRAFFIC_HOURS - 1) * 60 * 60 * 1000));
	// Each query fails soft on its own, and the block as a whole degrades to
	// null: a database that hasn't run migration 0007 loses the Traffic panel,
	// not the whole summary.
	const traffic = await Promise.all([
		listDailyViews(db, sinceDay),
		listViewsByPath(db, sinceDay),
		listReferrers(db, sinceDay),
		listCountries(db, sinceDay).catch(() => []),
		listDimension(db, 'os', sinceDay).catch(() => []),
		listDimension(db, 'browser', sinceDay).catch(() => []),
		listDimension(db, 'device', sinceDay).catch(() => []),
		listDimension(db, 'language', sinceDay).catch(() => []),
		listDimension(db, 'viewport', sinceDay).catch(() => []),
		trafficWindow === 1 ? listHourlyViews(db, sinceHour).catch(() => []) : Promise.resolve([]),
		// Empty on a site with no CMS traffic, and missing entirely before
		// migration 0014 — either way the panel just doesn't render.
		listTopContent(db, sinceDay).catch(() => [])
	]).then(
		([
			daily,
			byPath,
			referrers,
			countries,
			os,
			browsers,
			devices,
			languages,
			viewports,
			hourly,
			topContent
		]) => ({
			daily,
			hourly,
			byPath,
			topContent,
			referrers,
			countries,
			audience: { os, browsers, devices, languages, viewports }
		}),
		() => null
	);

	// Plan-limit meter. Wrapped so a missing table (before 0008 is applied)
	// degrades to "no data" instead of taking the summary down.
	const usage = await getUsage(db, now)
		.then((u) => ({ ...u, projection: projectUsage(u, now) }))
		.catch(() => null);

	return {
		trafficWindow,
		// Anchor for the hourly chart: the client must not re-derive it from its
		// own clock, or SSR and hydration disagree across an hour boundary.
		trafficNowHour: utcHourKey(now),
		traffic,
		usage,
		stats: {
			totalUsers: userCount?.count ?? 0,
			totalAdmins: adminCount?.count ?? 0,
			totalContent: contentCount?.count ?? 0,
			totalContactSubmissions: contactCount?.count ?? 0,
			totalChatMessages: chatCount?.count ?? 0,
			contentByStatus: {
				draft: contentBreakdown?.draft ?? 0,
				published: contentBreakdown?.published ?? 0,
				archived: contentBreakdown?.archived ?? 0
			},
			usersByMonth: fillMonthlySeries(usersByMonthRes?.results ?? []),
			contentByMonth: fillMonthlySeries(contentByMonthRes?.results ?? [])
		}
	};
}

export type StatsSummary = Awaited<ReturnType<typeof loadStatsSummary>>;
