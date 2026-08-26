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
import { error } from '@sveltejs/kit';
import { assertCanViewStats } from '$lib/server/stats-guard';
import type { PageServerLoad } from './$types';

const TRAFFIC_WINDOWS = [1, 7, 30, 90] as const;
/** The "1 day" window is plotted as this many trailing hourly buckets. */
const TRAFFIC_HOURS = 24;

export const load: PageServerLoad = async ({ platform, url, locals }) => {
	// Gated on the stats permission: owner always, plain admins only when
	// granted can_view_stats. The admin layout guard has already run.
	assertCanViewStats(locals.user);

	if (!platform?.env?.DB) {
		// Local dev without D1 — return a fully-shaped empty payload rather than
		// throwing, so the page still renders and explains itself.
		return {
			stats: null,
			traffic: null,
			usage: null,
			trafficWindow: 30,
			trafficNowHour: utcHourKey(new Date())
		};
	}

	try {
		const db = platform.env.DB;
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

		// Traffic. The window is a query param so the UI can toggle it with a
		// plain link — shareable, and it survives a reload.
		const requestedWindow = Number(url.searchParams.get('window'));
		const trafficWindow = (TRAFFIC_WINDOWS as readonly number[]).includes(requestedWindow)
			? requestedWindow
			: 30;
		const now = new Date();
		const sinceDay = utcDay(new Date(now.getTime() - trafficWindow * 24 * 60 * 60 * 1000));
		// The 1-day window is plotted hourly (a two-bar day chart is useless), so
		// it needs the trailing-24h counters as well. Wider windows skip the query.
		const sinceHour = utcHourKey(new Date(now.getTime() - (TRAFFIC_HOURS - 1) * 60 * 60 * 1000));
		// Each query fails soft on its own, and the block as a whole degrades to
		// null: a database that hasn't run migration 0007 loses the Traffic panel,
		// not the whole page.
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
		// degrades to "no data" instead of taking the stats page down.
		const usage = await getUsage(db, new Date())
			.then((u) => ({ ...u, projection: projectUsage(u, new Date()) }))
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
	} catch {
		throw error(500, 'Failed to load stats');
	}
};
