import { describe, expect, it } from 'vitest';
import {
	InvalidPublishAtError,
	dateHasArrived,
	fromLocalInputValue,
	isLiveItem,
	isScheduledItem,
	liveSql,
	parsePublishAt,
	resolvePublishedAt,
	toLocalInputValue
} from '../../src/lib/cms/schedule';

const NOW = new Date('2026-11-03T12:00:00.000Z');
const PAST = '2026-11-01T09:00:00.000Z';
const FUTURE = '2026-11-10T09:00:00.000Z';

describe('liveSql', () => {
	it('treats a missing date as live and normalises the date', () => {
		expect(liveSql('ci.published_at')).toBe(
			"(ci.published_at IS NULL OR datetime(ci.published_at) <= datetime('now'))"
		);
	});
});

describe('parsePublishAt', () => {
	it('passes undefined through, maps empty to null, normalises dates', () => {
		expect(parsePublishAt(undefined)).toBeUndefined();
		expect(parsePublishAt(null)).toBeNull();
		expect(parsePublishAt('')).toBeNull();
		expect(parsePublishAt('2026-11-10T09:00:00Z')).toBe('2026-11-10T09:00:00.000Z');
	});

	it('rejects values that are not dates, with an error the API maps to 400', () => {
		expect(() => parsePublishAt('soon')).toThrow(InvalidPublishAtError);
		expect(() => parsePublishAt(12)).toThrow(InvalidPublishAtError);
		try {
			parsePublishAt('soon');
		} catch (err) {
			expect((err as Error).name).toBe('CmsFieldValidationError');
		}
	});
});

describe('liveness', () => {
	it('knows when a date has arrived', () => {
		expect(dateHasArrived(null, NOW)).toBe(true);
		expect(dateHasArrived(PAST, NOW)).toBe(true);
		expect(dateHasArrived(FUTURE, NOW)).toBe(false);
		expect(dateHasArrived('garbage', NOW)).toBe(true);
	});

	it('separates live from scheduled from not published', () => {
		const live = { status: 'published', publishedAt: PAST };
		const undated = { status: 'published', publishedAt: null };
		const scheduled = { status: 'published', publishedAt: FUTURE };
		const draft = { status: 'draft', publishedAt: null };
		const archived = { status: 'archived', publishedAt: PAST };

		expect(isLiveItem(live, NOW)).toBe(true);
		expect(isLiveItem(undated, NOW)).toBe(true);
		expect(isLiveItem(scheduled, NOW)).toBe(false);
		expect(isLiveItem(draft, NOW)).toBe(false);
		expect(isLiveItem(archived, NOW)).toBe(false);

		expect(isScheduledItem(scheduled, NOW)).toBe(true);
		expect(isScheduledItem(live, NOW)).toBe(false);
		expect(isScheduledItem({ status: 'draft', publishedAt: FUTURE }, NOW)).toBe(false);
	});

	it('uses the real clock when none is given', () => {
		expect(isLiveItem({ status: 'published', publishedAt: '2000-01-01T00:00:00Z' })).toBe(true);
		expect(isScheduledItem({ status: 'published', publishedAt: '2999-01-01T00:00:00Z' })).toBe(
			true
		);
		expect(dateHasArrived('2999-01-01T00:00:00Z')).toBe(false);
	});
});

describe('resolvePublishedAt', () => {
	const run = (status: string, existing: string | null, requested?: string | null) =>
		resolvePublishedAt({ status, existing, requested, now: NOW });

	it('leaves the stored date alone unless publishing', () => {
		expect(run('draft', null, FUTURE)).toBeNull();
		expect(run('archived', PAST, FUTURE)).toBe(PAST);
	});

	it('never moves the date of an item that has gone live', () => {
		expect(run('published', PAST, FUTURE)).toBe(PAST);
		expect(run('published', PAST, null)).toBe(PAST);
	});

	it('takes the requested date on first publish, including a future one', () => {
		expect(run('published', null, FUTURE)).toBe(FUTURE);
		expect(run('published', null, PAST)).toBe(PAST);
	});

	it('publishes now when no date is given', () => {
		expect(run('published', null)).toBe(NOW.toISOString());
		expect(run('published', null, null)).toBe(NOW.toISOString());
	});

	it('lets a scheduled item be rescheduled or brought forward', () => {
		expect(run('published', FUTURE, '2026-12-01T00:00:00.000Z')).toBe('2026-12-01T00:00:00.000Z');
		expect(run('published', FUTURE, null)).toBe(NOW.toISOString());
	});

	it('keeps a scheduled date when the caller says nothing', () => {
		expect(run('published', FUTURE)).toBe(FUTURE);
	});

	it('defaults the clock to now', () => {
		const out = resolvePublishedAt({ status: 'published', existing: null, requested: undefined });
		expect(Date.parse(out as string)).toBeGreaterThan(Date.parse('2026-01-01'));
	});
});

describe('datetime-local helpers', () => {
	it('round-trips through local time', () => {
		const local = toLocalInputValue(FUTURE);
		expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
		expect(fromLocalInputValue(local)).toBe(FUTURE);
	});

	it('returns empty or null for missing and invalid input', () => {
		expect(toLocalInputValue(null)).toBe('');
		expect(toLocalInputValue(undefined)).toBe('');
		expect(toLocalInputValue('garbage')).toBe('');
		expect(fromLocalInputValue('')).toBeNull();
		expect(fromLocalInputValue(null)).toBeNull();
		expect(fromLocalInputValue('garbage')).toBeNull();
	});
});
