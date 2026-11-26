import { getAuction, getOrder, settleDueAuctions } from '@nebulakit/commerce';
import { jobMailer, mailLapsed, mailReminder, mailWinner } from '$lib/server/auction-emails';
import { auctionPricing } from '$lib/server/auction-pricing';
import type { CommerceEnv } from '$lib/server/site-info';
import type { ScheduledJob } from '../types';

/**
 * Close every auction whose time is up and give each sold one its order, so a
 * winner is billed even if nobody opens the page. Then lapse sales whose winner
 * missed the payment deadline, and send the emails that go with each step. Idempotent: an auction closes
 * once and has one order, so a retried or overlapping tick changes nothing.
 */
export const SETTLE_AUCTIONS_JOB: ScheduledJob = {
	id: 'settle-auctions',
	cron: '*/5 * * * *',
	path: '/api/cron/settle-auctions',
	description:
		'Close ended auctions, order and email the winners, remind and lapse those who have not paid.',
	timeoutMs: 30_000,
	async run({ db, env, now }) {
		const report = await settleDueAuctions(db, {
			now: now * 1000,
			pricing: auctionPricing(env as unknown as CommerceEnv),
			limit: 200
		});
		const mail = jobMailer(env, db);
		for (const id of report.ordered) {
			const auction = await getAuction(db, id);
			const order = auction?.orderId ? await getOrder(db, auction.orderId) : null;
			if (auction && order) await mailWinner(mail, auction, order);
		}
		for (const id of report.reminderIds) {
			const auction = await getAuction(db, id);
			if (auction) await mailReminder(mail, db, auction);
		}
		for (const id of report.lapsedIds) {
			const auction = await getAuction(db, id);
			if (auction) await mailLapsed(mail, auction);
		}
		const { ordered, lapsedIds, reminderIds, ...counts } = report;
		void ordered;
		void lapsedIds;
		void reminderIds;
		return { ...counts };
	}
};
