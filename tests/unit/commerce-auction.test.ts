import { describe, expect, it } from 'vitest';
import {
	bidderAlias,
	buyNow,
	buyNowAvailable,
	defaultIncrement,
	minimumBidCents,
	phaseOf,
	placeBid,
	reserveMet,
	settleAuction,
	validateAuctionTerms,
	MAX_EXTENSIONS,
	type AuctionState,
	type BidOutcome
} from '@nebulakit/commerce';

const T0 = Date.parse('2030-01-01T00:00:00Z');
const HOUR = 3600_000;

const base = (over: Partial<AuctionState> = {}): AuctionState => ({
	status: 'open',
	startingCents: 1000,
	reserveCents: null,
	buyNowCents: null,
	incrementCents: null,
	startsAt: T0,
	endsAt: T0 + 24 * HOUR,
	extendSeconds: 0,
	extensions: 0,
	currentCents: null,
	leaderId: null,
	leaderMaxCents: null,
	bidCount: 0,
	...over
});
const NOW = T0 + HOUR;

function bid(a: AuctionState, who: string, max: number, now = NOW): BidOutcome {
	const r = placeBid(a, { bidderId: who, maxCents: max }, now);
	if (!r.ok) throw new Error(`refused: ${r.reason}`);
	return r;
}

describe('increments', () => {
	it('grow with the price and never fall as it rises', () => {
		let last = 0;
		for (let c = 0; c < 2_000_000; c += 997) {
			const step = defaultIncrement(c);
			expect(step).toBeGreaterThanOrEqual(last);
			expect(Number.isInteger(step) && step > 0).toBe(true);
			last = step;
		}
	});
	it('sets the first bid at the starting price, then a step above the price', () => {
		const a = base();
		expect(minimumBidCents(a)).toBe(1000);
		const after = bid(a, 'amy', 5000).next;
		expect(after.currentCents).toBe(1000);
		expect(minimumBidCents(after)).toBe(1050);
		expect(minimumBidCents({ ...after, incrementCents: 300 })).toBe(1300);
	});
});

describe('proxy bidding', () => {
	it('shows only the price needed to lead', () => {
		const first = bid(base(), 'amy', 5000);
		expect(first.priceAfterCents).toBe(1000);
		expect(first.next.leaderMaxCents).toBe(5000);
		const second = bid(first.next, 'bo', 2000);
		expect(second.leading).toBe(false);
		expect(second.next.leaderId).toBe('amy');
		expect(second.priceAfterCents).toBe(2050); // bo's 2000 + one step
	});

	it('lets a higher max take the lead one step over the old max', () => {
		const a = bid(base(), 'amy', 2000).next;
		const r = bid(a, 'bo', 3000);
		expect(r.leading).toBe(true);
		expect(r.outbidId).toBe('amy');
		expect(r.priceAfterCents).toBe(2050);
	});

	it('never takes more than the winner’s own max', () => {
		const a = bid(base(), 'amy', 2000).next;
		const r = bid(a, 'bo', 2020); // above the minimum 1050, below one step over 2000
		expect(r.next.leaderId).toBe('bo');
		expect(r.priceAfterCents).toBe(2020);
	});

	it('gives a tie to the earlier bidder, at that amount', () => {
		const a = bid(base(), 'amy', 2000).next;
		const r = bid(a, 'bo', 2000);
		expect(r.leading).toBe(false);
		expect(r.next.leaderId).toBe('amy');
		expect(r.priceAfterCents).toBe(2000);
	});

	it('lets the leader raise their own max without moving the price', () => {
		const a = bid(base(), 'amy', 2000).next;
		const r = bid(a, 'amy', 4000);
		expect(r.priceAfterCents).toBe(a.currentCents);
		expect(r.next.leaderMaxCents).toBe(4000);
		expect(r.outbidId).toBeNull();
	});

	it('refuses a leader lowering or repeating their max', () => {
		const a = bid(base(), 'amy', 2000).next;
		for (const max of [2000, 1500, 1000]) {
			expect(placeBid(a, { bidderId: 'amy', maxCents: max }, NOW)).toMatchObject({
				ok: false,
				reason: 'already-leading'
			});
		}
	});

	it('refuses a bid under the minimum, and says what the minimum is', () => {
		const a = bid(base(), 'amy', 2000).next;
		expect(placeBid(a, { bidderId: 'bo', maxCents: a.currentCents! }, NOW)).toMatchObject({
			ok: false,
			reason: 'too-low',
			minimumCents: minimumBidCents(a)
		});
		expect(placeBid(base(), { bidderId: 'bo', maxCents: 999 }, NOW)).toMatchObject({
			reason: 'too-low',
			minimumCents: 1000
		});
	});

	it('refuses amounts that are not whole cents in range', () => {
		for (const max of [1000.5, -5, NaN, Infinity, 1e12, 100_000_000]) {
			expect(placeBid(base(), { bidderId: 'a', maxCents: max }, NOW)).toMatchObject({
				ok: false,
				reason: 'invalid-amount'
			});
		}
	});

	it('refuses bids before the start, after the end, and on a closed auction', () => {
		expect(placeBid(base(), { bidderId: 'a', maxCents: 2000 }, T0 - 1)).toMatchObject({
			reason: 'not-started'
		});
		expect(placeBid(base(), { bidderId: 'a', maxCents: 2000 }, T0 + 24 * HOUR)).toMatchObject({
			reason: 'ended'
		});
		for (const status of ['sold', 'unsold', 'cancelled'] as const) {
			expect(placeBid(base({ status }), { bidderId: 'a', maxCents: 2000 }, NOW)).toMatchObject({
				reason: 'not-open'
			});
		}
	});

	it('does not change the auction it was given', () => {
		const a = Object.freeze(base());
		expect(() => placeBid(a, { bidderId: 'amy', maxCents: 5000 }, NOW)).not.toThrow();
	});
});

describe('reserve', () => {
	it('lifts the price to the reserve once the leader’s max clears it', () => {
		const a = base({ reserveCents: 5000 });
		const r = bid(a, 'amy', 8000);
		expect(r.priceAfterCents).toBe(5000);
		expect(reserveMet(r.next)).toBe(true);
	});
	it('leaves the price alone while the leader’s max is under the reserve', () => {
		const r = bid(base({ reserveCents: 5000 }), 'amy', 4000);
		expect(r.priceAfterCents).toBe(1000);
		expect(reserveMet(r.next)).toBe(false);
	});
	it('does not sell below the reserve, and sells at the board price above it', () => {
		const under = bid(base({ reserveCents: 5000 }), 'amy', 4000).next;
		expect(settleAuction(under)).toEqual({ status: 'unsold', winnerId: null, finalCents: null });
		const over = bid(bid(base({ reserveCents: 5000 }), 'amy', 8000).next, 'bo', 6000).next;
		expect(settleAuction(over)).toEqual({ status: 'sold', winnerId: 'amy', finalCents: 6050 });
	});
});

describe('settlement', () => {
	it('ends unsold with no bids', () => {
		expect(settleAuction(base()).status).toBe('unsold');
	});
	it('charges the board price, never the winner’s max', () => {
		const a = bid(bid(base(), 'amy', 90_000).next, 'bo', 2000).next;
		const s = settleAuction(a);
		expect(s.finalCents).toBe(2050);
		expect(s.finalCents).toBeLessThan(a.leaderMaxCents!);
	});
});

describe('buy it now', () => {
	const a = base({ buyNowCents: 9000 });
	it('is on offer to start with, and ends the sale at that price', () => {
		expect(buyNowAvailable(a, NOW)).toBe(true);
		expect(buyNow(a, 'cy', NOW)).toEqual({
			ok: true,
			settlement: { status: 'sold', winnerId: 'cy', finalCents: 9000 }
		});
	});
	it('goes away with the first bid when there is no reserve', () => {
		const after = bid(a, 'amy', 2000).next;
		expect(buyNowAvailable(after, NOW)).toBe(false);
		expect(buy(after)).toEqual({ ok: false, reason: 'unavailable' });
	});
	it('stays while a reserve is unmet, and goes once it is met', () => {
		const r = base({ buyNowCents: 9000, reserveCents: 5000 });
		expect(buyNowAvailable(bid(r, 'amy', 3000).next, NOW)).toBe(true);
		expect(buyNowAvailable(bid(r, 'amy', 6000).next, NOW)).toBe(false);
	});
	it('is not on offer before the start or after the end', () => {
		expect(buyNowAvailable(a, T0 - 1)).toBe(false);
		expect(buyNowAvailable(a, T0 + 24 * HOUR)).toBe(false);
	});
	function buy(s: AuctionState) {
		return buyNow(s, 'cy', NOW);
	}
});

describe('soft close', () => {
	const closing = (over: Partial<AuctionState> = {}) =>
		base({ extendSeconds: 300, endsAt: T0 + 2 * HOUR, ...over });
	it('pushes the end out when a bid lands in the closing window', () => {
		const now = T0 + 2 * HOUR - 60_000;
		const r = bid(closing(), 'amy', 2000, now);
		expect(r.extended).toBe(true);
		expect(r.next.endsAt).toBe(now + 300_000);
		expect(r.next.extensions).toBe(1);
	});
	it('leaves the end alone for an early bid or when it is off', () => {
		const early = bid(closing(), 'amy', 2000, T0 + HOUR);
		expect(early.extended).toBe(false);
		expect(early.next.endsAt).toBe(T0 + 2 * HOUR);
		const off = bid(closing({ extendSeconds: 0 }), 'amy', 2000, T0 + 2 * HOUR - 1000);
		expect(off.next.endsAt).toBe(T0 + 2 * HOUR);
	});
	it('stops extending at the cap, so a war cannot run forever', () => {
		const now = T0 + 2 * HOUR - 1000;
		const r = bid(closing({ extensions: MAX_EXTENSIONS }), 'amy', 2000, now);
		expect(r.extended).toBe(false);
		expect(r.next.endsAt).toBe(T0 + 2 * HOUR);
	});
});

describe('bidding war properties', () => {
	// A deterministic pseudo-random sequence: the same war every run.
	function rng(seed: number) {
		return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
	}

	it('holds its invariants through thousands of random bids', () => {
		for (let seed = 1; seed <= 40; seed++) {
			const next = rng(seed);
			let a = base({
				startingCents: Math.floor(next() * 5000),
				reserveCents: next() < 0.5 ? null : 6000 + Math.floor(next() * 4000),
				incrementCents: next() < 0.3 ? 1 + Math.floor(next() * 400) : null
			});
			const maxes = new Map<string, number>();
			const names = ['amy', 'bo', 'cy', 'di'];
			for (let i = 0; i < 150; i++) {
				const who = names[Math.floor(next() * names.length)];
				const max = Math.floor(next() * 40_000);
				const r = placeBid(a, { bidderId: who, maxCents: max }, NOW);
				if (!r.ok) continue;
				const prev = a;
				a = r.next;
				maxes.set(who, Math.max(maxes.get(who) ?? 0, max));

				// Whole cents, always.
				expect(Number.isSafeInteger(a.currentCents)).toBe(true);
				// The price never falls.
				if (prev.currentCents !== null) {
					expect(a.currentCents!).toBeGreaterThanOrEqual(prev.currentCents);
				}
				// The price never exceeds the leader's own ceiling...
				expect(a.currentCents!).toBeLessThanOrEqual(a.leaderMaxCents!);
				// ...and the leader holds the highest max anyone has placed.
				expect(a.leaderMaxCents).toBe(Math.max(...maxes.values()));
				expect(maxes.get(a.leaderId!)).toBe(a.leaderMaxCents);
				// The price never starts below the starting price.
				expect(a.currentCents!).toBeGreaterThanOrEqual(a.startingCents);
				// The bid count counts accepted bids.
				expect(a.bidCount).toBe(prev.bidCount + 1);
				// A winner never pays more than they offered.
				const s = settleAuction(a);
				if (s.status === 'sold') expect(s.finalCents!).toBeLessThanOrEqual(a.leaderMaxCents!);
				else expect(s.finalCents).toBeNull();
			}
		}
	});
});

describe('setup validation', () => {
	const good = {
		startingCents: 1000,
		reserveCents: 5000,
		buyNowCents: 9000,
		incrementCents: null,
		startsAt: T0,
		endsAt: T0 + HOUR,
		extendSeconds: 300
	};
	it('accepts sensible terms', () => {
		expect(validateAuctionTerms(good)).toEqual([]);
		expect(
			validateAuctionTerms({ ...good, reserveCents: null, buyNowCents: null, extendSeconds: 0 })
		).toEqual([]);
	});
	it.each([
		['reserve under start', { reserveCents: 500 }],
		['buy-now at the start price', { buyNowCents: 1000 }],
		['buy-now under the reserve', { buyNowCents: 4000 }],
		['end before start', { endsAt: T0 - 1 }],
		['too long', { endsAt: T0 + 61 * 24 * HOUR }],
		['zero increment', { incrementCents: 0 }],
		['fractional start', { startingCents: 10.5 }],
		['huge reserve', { reserveCents: 1e12 }],
		['bad date', { startsAt: NaN }],
		['extension too long', { extendSeconds: 7200 }]
	])('refuses %s', (_name, over) => {
		expect(validateAuctionTerms({ ...good, ...over }).length).toBeGreaterThan(0);
	});
});

describe('phase and alias', () => {
	it('reads scheduled, live and ended from the clock', () => {
		expect(phaseOf(base(), T0 - 1)).toBe('scheduled');
		expect(phaseOf(base(), NOW)).toBe('live');
		expect(phaseOf(base(), T0 + 24 * HOUR)).toBe('ended');
		expect(phaseOf(base({ status: 'sold' }), NOW)).toBe('sold');
	});
	it('names a bidder stably without exposing the id', () => {
		expect(bidderAlias('user-1')).toBe(bidderAlias('user-1'));
		expect(bidderAlias('user-1')).not.toBe(bidderAlias('user-2'));
		expect(bidderAlias('user-1')).toMatch(/^Bidder [0-9A-F]{4}$/);
		expect(bidderAlias('user-1')).not.toContain('user-1');
	});
});
