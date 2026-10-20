import { describe, expect, it } from 'vitest';
import {
	actionsCollapsed,
	addRecentQuery,
	bellLabel,
	canRetryError,
	checklistProgress,
	checklistSummary,
	clampToolbarStop,
	createConfirmation,
	calendarDayDistance,
	calendarDay,
	EMPTY_PRESETS,
	ERROR_PRESETS,
	firstOpenStep,
	fitToolbarCount,
	formatCountBadge,
	formatNotificationTime,
	gateStep,
	timeAttribute,
	groupNotificationsByDay,
	groupSearchResults,
	searchItemScore,
	markAllNotificationsRead,
	markNotificationRead,
	searchHighlightSegments,
	searchMatchScore,
	isNavCurrent,
	navItemName,
	rankSearchItems,
	wizardRequiredRule,
	resolveEmptyCopy,
	resolveErrorCopy,
	rovingTabindex,
	runWizardRules,
	searchStatus,
	setStepDone,
	splitToolbarOverflow,
	parseTime,
	toggleOpenStep,
	unreadCount,
	visibleStepErrors,
	wizardIsFirst,
	wizardIsLast,
	wizardProgressText,
	wizardReduce,
	wizardStart,
	wizardStepperSteps,
	type ErrorKind,
	type EmptyKind,
	type NotificationItem,
	type SearchItem,
	type WizardState
} from './logic';

describe('dates', () => {
	it('reads valid times and rejects invalid ones', () => {
		expect(parseTime('2026-10-13T00:00:00Z')?.getTime()).toBe(Date.UTC(2026, 9, 13));
		expect(parseTime(0)?.getTime()).toBe(0);
		const d = new Date(5);
		expect(parseTime(d)).toBe(d);
		expect(parseTime('nonsense')).toBeNull();
		expect(parseTime(NaN)).toBeNull();
	});

	it('writes an ISO time, or nothing', () => {
		expect(timeAttribute(0)).toBe('1970-01-01T00:00:00.000Z');
		expect(timeAttribute('bad')).toBe('');
	});

	it('names the calendar day in a time zone', () => {
		const at = '2026-10-13T02:30:00Z';
		expect(calendarDay(at)).toBe('2026-10-13');
		expect(calendarDay(at, 'America/Phoenix')).toBe('2026-10-12');
		expect(calendarDay(at, 'Asia/Tokyo')).toBe('2026-10-13');
		expect(calendarDay('bad')).toBeNull();
	});

	it('counts calendar days between keys, across months and years', () => {
		expect(calendarDayDistance('2026-10-12', '2026-10-13')).toBe(1);
		expect(calendarDayDistance('2026-10-13', '2026-10-13')).toBe(0);
		expect(calendarDayDistance('2026-09-30', '2026-10-01')).toBe(1);
		expect(calendarDayDistance('2025-12-31', '2026-01-01')).toBe(1);
		expect(calendarDayDistance('2026-10-13', '2026-10-12')).toBe(-1);
	});
});

const n = (id: string, at: string | number, read = false): NotificationItem => ({
	id,
	title: id,
	at,
	read
});

describe('groupNotificationsByDay', () => {
	const now = '2026-10-13T15:00:00Z';

	it('groups into Today, Yesterday and dated days, newest first', () => {
		const groups = groupNotificationsByDay(
			[
				n('old', '2026-10-01T09:00:00Z'),
				n('t-early', '2026-10-13T01:00:00Z'),
				n('y', '2026-10-12T23:00:00Z'),
				n('t-late', '2026-10-13T14:00:00Z'),
				n('older', '2026-10-09T09:00:00Z')
			],
			now
		);
		expect(groups.map((g) => g.label)).toEqual([
			'Today',
			'Yesterday',
			'Friday, October 9',
			'Thursday, October 1'
		]);
		expect(groups[0].items.map((i) => i.id)).toEqual(['t-late', 't-early']);
		expect(groups.map((g) => g.key)).toEqual([
			'2026-10-13',
			'2026-10-12',
			'2026-10-09',
			'2026-10-01'
		]);
	});

	it('uses the time zone for the day boundaries', () => {
		const items = [n('a', '2026-10-13T02:30:00Z')];
		const utc = groupNotificationsByDay(items, now);
		const phx = groupNotificationsByDay(items, now, { timeZone: 'America/Phoenix' });
		expect(utc[0].label).toBe('Today');
		expect(phx[0].label).toBe('Yesterday');
	});

	it('takes translated labels and a locale', () => {
		const groups = groupNotificationsByDay(
			[n('a', now), n('b', '2026-10-12T10:00:00Z'), n('c', '2026-10-01T10:00:00Z')],
			now,
			{ todayLabel: 'Hoy', yesterdayLabel: 'Ayer', locale: 'es' }
		);
		expect(groups[0].label).toBe('Hoy');
		expect(groups[1].label).toBe('Ayer');
		expect(groups[2].label.toLowerCase()).toContain('octubre');
	});

	it('puts unreadable times last, under their own label', () => {
		const groups = groupNotificationsByDay([n('x', 'bad'), n('a', now)], now, {
			undatedLabel: 'No date'
		});
		expect(groups.map((g) => g.label)).toEqual(['Today', 'No date']);
		expect(groups[1].key).toBe('undated');
	});

	it('treats an unreadable now as every day being older', () => {
		const groups = groupNotificationsByDay([n('a', now)], 'bad');
		expect(groups[0].label).toBe('Tuesday, October 13');
	});

	it('returns nothing for nothing', () => {
		expect(groupNotificationsByDay([], now)).toEqual([]);
	});

	it('accepts epoch and Date times', () => {
		const groups = groupNotificationsByDay(
			[n('a', Date.UTC(2026, 9, 13, 10)), { ...n('b', 0), at: new Date(Date.UTC(2026, 9, 13, 9)) }],
			now
		);
		expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
	});
});

describe('notification state', () => {
	const list = [n('a', 1, false), n('b', 2, true), n('c', 3, false)];

	it('counts unread', () => {
		expect(unreadCount(list)).toBe(2);
		expect(unreadCount([])).toBe(0);
	});

	it('marks one read without touching the rest or the input', () => {
		const out = markNotificationRead(list, 'a');
		expect(out.map((i) => i.read)).toEqual([true, true, false]);
		expect(list[0].read).toBe(false);
		expect(out[1]).toBe(list[1]);
		expect(markNotificationRead(list, 'zzz').map((i) => i.read)).toEqual([false, true, false]);
	});

	it('marks all read', () => {
		const out = markAllNotificationsRead(list);
		expect(out.every((i) => i.read)).toBe(true);
		expect(out[1]).toBe(list[1]);
	});

	it('formats a badge count with a cap', () => {
		expect(formatCountBadge(0)).toBe('');
		expect(formatCountBadge(-3)).toBe('');
		expect(formatCountBadge(NaN)).toBe('');
		expect(formatCountBadge(7)).toBe('7');
		expect(formatCountBadge(7.9)).toBe('7');
		expect(formatCountBadge(99)).toBe('99');
		expect(formatCountBadge(100)).toBe('99+');
		expect(formatCountBadge(12, 9)).toBe('9+');
	});

	it('puts the unread count in the bell name', () => {
		expect(bellLabel('Notifications', 0)).toBe('Notifications');
		expect(bellLabel('Notifications', 3)).toBe('Notifications, 3 unread');
		expect(bellLabel('Avisos', 1, 'sin leer')).toBe('Avisos, 1 sin leer');
	});

	it('formats a time of day', () => {
		expect(formatNotificationTime('2026-10-13T14:05:00Z')).toBe('2:05 PM');
		expect(formatNotificationTime('2026-10-13T14:05:00Z', 'en-US', 'America/Phoenix')).toBe(
			'7:05 AM'
		);
		expect(formatNotificationTime('bad')).toBe('');
	});
});

describe('searchMatchScore', () => {
	it('ranks exact, prefix, word start, substring, words, subsequence', () => {
		expect(searchMatchScore('Billing', 'billing')).toBe(100);
		expect(searchMatchScore('Billing settings', 'bill')).toBe(80);
		expect(searchMatchScore('Team billing', 'bill')).toBe(60);
		expect(searchMatchScore('Rebilling', 'bill')).toBe(40);
		expect(searchMatchScore('Open the billing page', 'page billing')).toBe(30);
		expect(searchMatchScore('Billing', 'bng')).toBe(10);
		expect(searchMatchScore('Billing', 'xyz')).toBe(0);
	});

	it('treats an empty query as a weak match for everything', () => {
		expect(searchMatchScore('anything', '')).toBe(1);
		expect(searchMatchScore('anything', '   ')).toBe(1);
	});

	it('is safe with regex characters', () => {
		expect(searchMatchScore('a (b) c', '(b')).toBe(60);
		expect(searchMatchScore('abc', '[')).toBe(0);
	});

	it('treats separators as word starts', () => {
		expect(searchMatchScore('new-project', 'project')).toBe(60);
		expect(searchMatchScore('go/home', 'home')).toBe(60);
	});

	it('needs the whole subsequence', () => {
		expect(searchMatchScore('ab', 'abc')).toBe(0);
	});
});

describe('rankSearchItems', () => {
	const items: SearchItem[] = [
		{ id: 'a', label: 'Team settings', group: 'Pages' },
		{ id: 'b', label: 'Settings', group: 'Pages' },
		{ id: 'c', label: 'Invite', keywords: ['settings', 'people'], group: 'Actions' },
		{ id: 'd', label: 'Profile', description: 'Edit your settings here', group: 'Pages' },
		{ id: 'e', label: 'Logout' }
	];

	it('scores keywords at half and descriptions at a quarter', () => {
		expect(searchItemScore(items[2], 'settings')).toBe(50);
		expect(searchItemScore(items[3], 'settings')).toBe(15);
		expect(searchItemScore(items[0], 'settings')).toBe(60);
		expect(searchItemScore(items[4], 'settings')).toBe(0);
		expect(searchItemScore(items[4], '')).toBe(1);
	});

	it('orders by score then by input order, dropping non-matches', () => {
		expect(rankSearchItems(items, 'settings').map((i) => i.id)).toEqual(['b', 'a', 'c', 'd']);
	});

	it('keeps everything in order for an empty query', () => {
		expect(rankSearchItems(items, ' ').map((i) => i.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
	});

	it('returns nothing when nothing matches', () => {
		expect(rankSearchItems(items, 'qqq')).toEqual([]);
	});

	it('groups in order of first appearance, with a fallback group', () => {
		const groups = groupSearchResults(rankSearchItems(items, 'settings'));
		expect(groups.map((g) => g.label)).toEqual(['Pages', 'Actions']);
		expect(groups[0].items.map((i) => i.id)).toEqual(['b', 'a', 'd']);
		const all = groupSearchResults(items, 'Other');
		expect(all.map((g) => g.label)).toEqual(['Pages', 'Actions', 'Other']);
		expect(groupSearchResults([])).toEqual([]);
	});
});

describe('searchHighlightSegments', () => {
	it('splits a text around its matches, ignoring case', () => {
		expect(searchHighlightSegments('Team Settings', 'set')).toEqual([
			{ text: 'Team ', match: false },
			{ text: 'Set', match: true },
			{ text: 'tings', match: false }
		]);
	});

	it('marks several words and repeats', () => {
		expect(searchHighlightSegments('a b a', 'a b').map((s) => [s.text, s.match])).toEqual([
			['a', true],
			[' ', false],
			['b', true],
			[' ', false],
			['a', true]
		]);
	});

	it('merges overlapping and touching hits', () => {
		expect(searchHighlightSegments('abcdef', 'abc cde')).toEqual([
			{ text: 'abcde', match: true },
			{ text: 'f', match: false }
		]);
		expect(searchHighlightSegments('abcd', 'ab cd')).toEqual([{ text: 'abcd', match: true }]);
		expect(searchHighlightSegments('abcdef', 'abcd bc')).toEqual([
			{ text: 'abcd', match: true },
			{ text: 'ef', match: false }
		]);
	});

	it('merges hits that start together', () => {
		expect(searchHighlightSegments('abc', 'abc ab')).toEqual([{ text: 'abc', match: true }]);
		expect(searchHighlightSegments('abc', 'ab abc')).toEqual([{ text: 'abc', match: true }]);
	});

	it('returns the whole text when there is no query or no hit', () => {
		expect(searchHighlightSegments('Hello', '')).toEqual([{ text: 'Hello', match: false }]);
		expect(searchHighlightSegments('Hello', 'zz')).toEqual([{ text: 'Hello', match: false }]);
		expect(searchHighlightSegments('', 'a')).toEqual([]);
	});

	it('does not highlight when lowercasing changes the length', () => {
		expect(searchHighlightSegments('İ', 'i')).toEqual([{ text: 'İ', match: false }]);
	});
});

describe('recent searches and status', () => {
	it('adds newest first, de-duplicating without regard to case', () => {
		expect(addRecentQuery([], ' invoices ')).toEqual(['invoices']);
		expect(addRecentQuery(['a', 'Invoices', 'b'], 'invoices')).toEqual(['invoices', 'a', 'b']);
		expect(addRecentQuery(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
		expect(addRecentQuery(['a'], '   ')).toEqual(['a']);
		expect(addRecentQuery(['a'], 'b', 0)).toEqual([]);
	});

	it('says what the results are', () => {
		expect(searchStatus('x', 0, true)).toBe('Searching…');
		expect(searchStatus('', 3, false)).toBe('');
		expect(searchStatus('x', 0, false)).toBe('No results found.');
		expect(searchStatus('x', 1, false)).toBe('1 result');
		expect(searchStatus('x', 4, false)).toBe('4 results');
		expect(
			searchStatus('x', 4, false, {
				many: '{n} resultados',
				one: 'Uno',
				none: 'Nada',
				loading: '…'
			})
		).toBe('4 resultados');
		expect(searchStatus('x', 1, false, { one: 'Uno' })).toBe('Uno');
		expect(searchStatus('x', 0, false, { none: 'Nada' })).toBe('Nada');
		expect(searchStatus('x', 0, true, { loading: 'Buscando' })).toBe('Buscando');
	});
});

describe('wizard state machine', () => {
	const start = wizardStart(3);

	it('starts in range', () => {
		expect(start).toEqual({ index: 0, count: 3, furthest: 0, attempted: false, finished: false });
		expect(wizardStart(3, 2).index).toBe(2);
		expect(wizardStart(3, 9).index).toBe(2);
		expect(wizardStart(3, -4).index).toBe(0);
		expect(wizardStart(0).index).toBe(0);
		expect(wizardStart(-2).count).toBe(0);
		expect(wizardStart(3, 1.9).index).toBe(1);
	});

	it('knows first and last', () => {
		expect(wizardIsFirst(start)).toBe(true);
		expect(wizardIsLast(start)).toBe(false);
		expect(wizardIsLast({ ...start, index: 2 })).toBe(true);
		expect(wizardIsFirst({ ...start, index: 2 })).toBe(false);
	});

	it('refuses to advance an invalid step, and flags the attempt', () => {
		const s = wizardReduce(start, { type: 'next', valid: false });
		expect(s.index).toBe(0);
		expect(s.attempted).toBe(true);
	});

	it('advances a valid step and clears the attempt', () => {
		const stuck = wizardReduce(start, { type: 'next', valid: false });
		const s = wizardReduce(stuck, { type: 'next', valid: true });
		expect(s).toMatchObject({ index: 1, furthest: 1, attempted: false });
	});

	it('does not advance past the last step', () => {
		const last = { ...start, index: 2, furthest: 2 };
		expect(wizardReduce(last, { type: 'next', valid: true })).toBe(last);
	});

	it('goes back without validation, and keeps the furthest reached', () => {
		let s = wizardReduce(start, { type: 'next', valid: true });
		s = wizardReduce(s, { type: 'back' });
		expect(s).toMatchObject({ index: 0, furthest: 1 });
		expect(wizardReduce(s, { type: 'back' })).toBe(s);
	});

	it('jumps back freely, forward only to reached steps from a valid one', () => {
		let s: WizardState = { ...start, index: 2, furthest: 2 };
		s = wizardReduce(s, { type: 'goto', index: 0, valid: false });
		expect(s.index).toBe(0);
		expect(wizardReduce(s, { type: 'goto', index: 2, valid: false })).toMatchObject({
			index: 0,
			attempted: true
		});
		expect(wizardReduce(s, { type: 'goto', index: 2, valid: true }).index).toBe(2);
		const fresh = wizardStart(3);
		expect(wizardReduce(fresh, { type: 'goto', index: 2, valid: true })).toBe(fresh);
		expect(wizardReduce(fresh, { type: 'goto', index: 0, valid: true })).toBe(fresh);
		expect(wizardReduce(fresh, { type: 'goto', index: -1, valid: true })).toBe(fresh);
		expect(wizardReduce(fresh, { type: 'goto', index: 7, valid: true })).toBe(fresh);
	});

	it('finishes only on the last step and only when valid', () => {
		expect(wizardReduce(start, { type: 'finish', valid: true })).toBe(start);
		const last = { ...start, index: 2, furthest: 2 };
		expect(wizardReduce(last, { type: 'finish', valid: false })).toMatchObject({
			finished: false,
			attempted: true
		});
		const done = wizardReduce(last, { type: 'finish', valid: true });
		expect(done.finished).toBe(true);
	});

	it('is inert once finished, until reset', () => {
		const done: WizardState = { ...start, index: 2, furthest: 2, finished: true };
		expect(wizardReduce(done, { type: 'back' })).toBe(done);
		expect(wizardReduce(done, { type: 'reset' })).toEqual(start);
	});

	it('is inert with no steps', () => {
		const empty = wizardStart(0);
		expect(wizardReduce(empty, { type: 'next', valid: true })).toBe(empty);
	});

	it('writes the progress text', () => {
		expect(wizardProgressText({ index: 1, count: 4 })).toBe('Step 2 of 4');
		expect(wizardProgressText({ index: 1, count: 4 }, 'Account')).toBe('Step 2 of 4: Account');
		expect(wizardProgressText({ index: 0, count: 2 }, 'Cuenta', 'Paso {n} de {total}')).toBe(
			'Paso 1 de 2: Cuenta'
		);
	});
});

describe('step validation gating', () => {
	it('requires a value', () => {
		const rule = wizardRequiredRule();
		for (const empty of [null, undefined, '', '   ', false, []]) {
			expect(rule(empty, {})).toBe('This field is required.');
		}
		for (const filled of ['a', 0, true, ['x']]) {
			expect(rule(filled, {})).toBeNull();
		}
		expect(wizardRequiredRule('Needed')('', {})).toBe('Needed');
	});

	it('runs rules over values and keeps only the failures', () => {
		const errors = runWizardRules(
			{
				name: wizardRequiredRule('Name?'),
				email: (v) => (String(v).includes('@') ? null : 'Not an email'),
				confirm: (v, all) => (v === all.email ? null : 'Does not match')
			},
			{ name: '', email: 'a@b.c', confirm: 'a@b.c' }
		);
		expect(errors).toEqual({ name: 'Name?' });
	});

	it('gates on the error list', () => {
		expect(gateStep({})).toEqual({ valid: true, list: [] });
		expect(gateStep({ a: 'Bad', b: '' })).toEqual({
			valid: false,
			list: [{ field: 'a', message: 'Bad' }]
		});
	});

	it('shows errors only after an attempt', () => {
		const errors = { a: 'Bad' };
		expect(visibleStepErrors(errors, false)).toEqual({});
		expect(visibleStepErrors(errors, true)).toBe(errors);
	});

	it('flags the refused step on the stepper', () => {
		const steps = [
			{ id: 'a', label: 'A' },
			{ id: 'b', label: 'B' }
		];
		expect(
			wizardStepperSteps(steps, { index: 1, attempted: true }, true).map((s) => s.error)
		).toEqual([false, true]);
		expect(wizardStepperSteps(steps, { index: 1, attempted: false }, true)[1].error).toBe(false);
		expect(wizardStepperSteps(steps, { index: 1, attempted: true }, false)[1].error).toBe(false);
	});
});

describe('checklist', () => {
	const steps = [
		{ id: 'a', done: true },
		{ id: 'b', done: false },
		{ id: 'c', done: false }
	];

	it('computes progress', () => {
		expect(checklistProgress(steps)).toEqual({ done: 1, total: 3, percent: 33, complete: false });
		expect(checklistProgress([{ done: true }])).toEqual({
			done: 1,
			total: 1,
			percent: 100,
			complete: true
		});
		expect(checklistProgress([])).toEqual({ done: 0, total: 0, percent: 0, complete: false });
	});

	it('finds the first open step', () => {
		expect(firstOpenStep(steps)?.id).toBe('b');
		expect(firstOpenStep([{ done: true }])).toBeNull();
	});

	it('sets a step done without mutating', () => {
		const out = setStepDone(steps, 'b', true);
		expect(out.map((s) => s.done)).toEqual([true, true, false]);
		expect(steps[1].done).toBe(false);
		expect(out[0]).toBe(steps[0]);
		expect(setStepDone(steps, 'a', true)[0]).toBe(steps[0]);
		expect(setStepDone(steps, 'zzz', true)).toEqual(steps);
	});

	it('toggles the expanded step', () => {
		expect(toggleOpenStep(null, 'a')).toBe('a');
		expect(toggleOpenStep('a', 'a')).toBeNull();
		expect(toggleOpenStep('a', 'b')).toBe('b');
	});

	it('summarises', () => {
		expect(checklistSummary({ done: 2, total: 5 })).toBe('2 of 5 done');
		expect(checklistSummary({ done: 2, total: 5 }, '{done}/{total}')).toBe('2/5');
	});
});

describe('presets', () => {
	it('has copy for every error and empty kind', () => {
		const errors: ErrorKind[] = ['404', '403', '500', 'offline', 'maintenance'];
		for (const kind of errors) {
			expect(ERROR_PRESETS[kind].title.length).toBeGreaterThan(3);
			expect(ERROR_PRESETS[kind].description.length).toBeGreaterThan(10);
		}
		const empties: EmptyKind[] = ['no-data', 'no-results', 'first-run'];
		for (const kind of empties) expect(EMPTY_PRESETS[kind].title.length).toBeGreaterThan(3);
	});

	it('knows which errors are worth a retry', () => {
		expect(canRetryError('500')).toBe(true);
		expect(canRetryError('offline')).toBe(true);
		expect(canRetryError('maintenance')).toBe(true);
		expect(canRetryError('404')).toBe(false);
		expect(canRetryError('403')).toBe(false);
	});

	it('resolves error copy with overrides, ignoring blanks, falling back on unknown kinds', () => {
		expect(resolveErrorCopy('404').title).toBe('Page not found');
		expect(resolveErrorCopy('404', { title: ' Gone ', description: '' })).toMatchObject({
			title: 'Gone',
			description: ERROR_PRESETS['404'].description,
			code: '404'
		});
		expect(resolveErrorCopy('weird' as ErrorKind).title).toBe('Something went wrong');
	});

	it('resolves empty copy, quoting the query for no-results', () => {
		expect(resolveEmptyCopy('first-run').title).toBe('Let’s get you started');
		expect(resolveEmptyCopy('no-results', { query: ' tax ' }).description).toContain('“tax”');
		expect(resolveEmptyCopy('no-results').description).toBe(
			EMPTY_PRESETS['no-results'].description
		);
		expect(resolveEmptyCopy('no-data', { query: 'tax' }).description).toBe(
			EMPTY_PRESETS['no-data'].description
		);
		expect(resolveEmptyCopy('no-data', { title: 'Zip', description: 'Zap' })).toMatchObject({
			title: 'Zip',
			description: 'Zap'
		});
		expect(resolveEmptyCopy('weird' as EmptyKind).title).toBe('Nothing here yet');
	});
});

describe('createConfirmation', () => {
	it('resolves with the answer', async () => {
		const c = createConfirmation();
		expect(c.pending).toBe(false);
		const p = c.ask();
		expect(c.pending).toBe(true);
		c.answer(true);
		await expect(p).resolves.toBe(true);
		expect(c.pending).toBe(false);
	});

	it('cancels an ask that is still pending when another starts', async () => {
		const c = createConfirmation();
		const first = c.ask();
		const second = c.ask();
		await expect(first).resolves.toBe(false);
		c.answer(true);
		await expect(second).resolves.toBe(true);
	});

	it('ignores an answer when nothing is pending', () => {
		const c = createConfirmation();
		expect(() => c.answer(true)).not.toThrow();
	});
});

describe('toolbar and nav helpers', () => {
	it('fits what it can, reserving room for the overflow button', () => {
		expect(fitToolbarCount([40, 40, 40], 0)).toBe(3);
		expect(fitToolbarCount([], 100)).toBe(0);
		expect(fitToolbarCount([40, 40, 40], 200)).toBe(3);
		expect(fitToolbarCount([40, 40, 40], 100, 30)).toBe(1);
		expect(fitToolbarCount([40, 40, 40], 119, 30)).toBe(2);
		expect(fitToolbarCount([40, 40, 40], 10, 30)).toBe(0);
		expect(fitToolbarCount([40, 40, 40], 128, 0, 4)).toBe(3);
		expect(fitToolbarCount([40, 40, 40], 120, 0, 4)).toBe(2);
	});

	it('splits into shown and overflow', () => {
		expect(splitToolbarOverflow([1, 2, 3, 4], 2)).toEqual({ shown: [1, 2], overflow: [3, 4] });
		expect(splitToolbarOverflow([1, 2], 9)).toEqual({ shown: [1, 2], overflow: [] });
		expect(splitToolbarOverflow([1, 2], -1)).toEqual({ shown: [], overflow: [1, 2] });
	});

	it('collapses actions only when the width is known and small', () => {
		expect(actionsCollapsed(0, 600)).toBe(false);
		expect(actionsCollapsed(400, 600)).toBe(true);
		expect(actionsCollapsed(600, 600)).toBe(false);
	});

	it('keeps exactly one tab stop', () => {
		expect(rovingTabindex(3, 1)).toEqual([-1, 0, -1]);
		expect(rovingTabindex(3, 9)).toEqual([0, -1, -1]);
		expect(rovingTabindex(3, -1)).toEqual([0, -1, -1]);
		expect(rovingTabindex(0, 0)).toEqual([]);
	});

	it('clamps an index', () => {
		expect(clampToolbarStop(5, 3)).toBe(2);
		expect(clampToolbarStop(-1, 3)).toBe(0);
		expect(clampToolbarStop(1, 3)).toBe(1);
		expect(clampToolbarStop(4, 0)).toBe(0);
	});

	it('finds the current nav item', () => {
		expect(isNavCurrent('/docs', '/docs')).toBe(true);
		expect(isNavCurrent('/docs/', '/docs?tab=1')).toBe(true);
		expect(isNavCurrent('/docs', '/docs/intro')).toBe(false);
		expect(isNavCurrent('/docs', '/docs/intro', false)).toBe(true);
		expect(isNavCurrent('/docs', '/documents', false)).toBe(false);
		expect(isNavCurrent('/', '/docs', false)).toBe(false);
		expect(isNavCurrent('/', '/')).toBe(true);
		expect(isNavCurrent('', '/x')).toBe(false);
		expect(isNavCurrent('/x', '')).toBe(false);
	});

	it('names a nav item with its badge', () => {
		expect(navItemName('Inbox')).toBe('Inbox');
		expect(navItemName('Inbox', 0)).toBe('Inbox');
		expect(navItemName('Inbox', '')).toBe('Inbox');
		expect(navItemName('Inbox', 3)).toBe('Inbox, 3');
		expect(navItemName('Inbox', 3, 'new')).toBe('Inbox, 3 new');
	});
});
