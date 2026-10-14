import { describe, expect, it } from 'vitest';
import * as L from './logic';

const NOW = '2026-03-15T12:00:00Z';

describe('appearance', () => {
	it('clamps and snaps text size', () => {
		expect(L.clampTextSize(100)).toBe(100);
		expect(L.clampTextSize(10)).toBe(L.TEXT_SIZE_MIN);
		expect(L.clampTextSize(999)).toBe(L.TEXT_SIZE_MAX);
		expect(L.clampTextSize(112)).toBe(110);
		expect(L.clampTextSize('125')).toBe(125);
		expect(L.clampTextSize('abc')).toBe(100);
		expect(L.clampTextSize(NaN)).toBe(100);
		expect(L.clampTextSize(undefined)).toBe(100);
	});

	it('normalizes partial, junk and missing input', () => {
		expect(L.normalizeAppearance(null)).toEqual(L.DEFAULT_APPEARANCE);
		expect(L.normalizeAppearance(undefined)).toEqual(L.DEFAULT_APPEARANCE);
		expect(
			L.normalizeAppearance({
				theme: 'dark',
				density: 'compact',
				textSize: 120,
				reduceMotion: true
			})
		).toEqual({ theme: 'dark', density: 'compact', textSize: 120, reduceMotion: true });
		expect(
			L.normalizeAppearance({ theme: 'neon' as never, density: 'x' as never, textSize: 5 })
		).toEqual({ theme: 'system', density: 'comfortable', textSize: 80, reduceMotion: false });
		expect(L.normalizeAppearance({ reduceMotion: 'yes' as never }).reduceMotion).toBe(false);
	});

	it('resolves the system theme', () => {
		expect(L.resolveTheme('system', true)).toBe('dark');
		expect(L.resolveTheme('system', false)).toBe('light');
		expect(L.resolveTheme('light', true)).toBe('light');
		expect(L.resolveTheme('dark', false)).toBe('dark');
	});

	it('builds the preview style from density and size', () => {
		expect(L.previewStyle({ ...L.DEFAULT_APPEARANCE, textSize: 120 })).toBe(
			'font-size:120%;--preview-gap:1rem;--preview-pad:1rem'
		);
		expect(L.previewStyle({ ...L.DEFAULT_APPEARANCE, density: 'compact' })).toContain(
			'--preview-gap:0.5rem'
		);
	});

	it('detects change in each field', () => {
		const a = L.DEFAULT_APPEARANCE;
		expect(L.appearanceChanged(a, { ...a })).toBe(false);
		expect(L.appearanceChanged(a, { ...a, theme: 'dark' })).toBe(true);
		expect(L.appearanceChanged(a, { ...a, density: 'compact' })).toBe(true);
		expect(L.appearanceChanged(a, { ...a, textSize: 90 })).toBe(true);
		expect(L.appearanceChanged(a, { ...a, reduceMotion: true })).toBe(true);
	});
});

describe('notification matrix', () => {
	const events = ['a', 'b'];
	const channels = ['email', 'push', 'sms'];

	it('creates a full matrix honouring initial values', () => {
		const m = L.createMatrix(events, channels, { a: { email: true }, zzz: { email: true } });
		expect(m).toEqual({
			a: { email: true, push: false, sms: false },
			b: { email: false, push: false, sms: false }
		});
	});

	it('toggles one cell and ignores unknown ones', () => {
		const m = L.createMatrix(events, channels);
		const t = L.toggleCell(m, 'a', 'push');
		expect(t.a.push).toBe(true);
		expect(m.a.push).toBe(false);
		expect(L.toggleCell(m, 'nope', 'push')).toBe(m);
		expect(L.toggleCell(m, 'a', 'nope')).toBe(m);
	});

	it('reports row, column and overall state', () => {
		let m = L.createMatrix(events, channels);
		expect(L.rowState(m, 'a')).toBe('none');
		expect(L.columnState(m, 'email')).toBe('none');
		expect(L.matrixState(m)).toBe('none');
		m = L.toggleCell(m, 'a', 'email');
		expect(L.rowState(m, 'a')).toBe('mixed');
		expect(L.columnState(m, 'email')).toBe('mixed');
		expect(L.matrixState(m)).toBe('mixed');
		m = L.setRow(m, 'a', true);
		expect(L.rowState(m, 'a')).toBe('all');
		m = L.setColumn(m, 'email', true);
		expect(L.columnState(m, 'email')).toBe('all');
		expect(L.matrixState(L.setAll(m, true))).toBe('all');
		expect(L.rowState(m, 'missing')).toBe('none');
		expect(L.columnState(m, 'missing')).toBe('none');
		expect(L.matrixState({})).toBe('none');
	});

	it('picks the next bulk value: only "all" turns off', () => {
		expect(L.nextBulkValue('none')).toBe(true);
		expect(L.nextBulkValue('mixed')).toBe(true);
		expect(L.nextBulkValue('all')).toBe(false);
	});

	it('sets rows, columns and everything', () => {
		const m = L.createMatrix(events, channels);
		expect(L.setRow(m, 'a', true).a).toEqual({ email: true, push: true, sms: true });
		expect(L.setRow(m, 'a', true).b.email).toBe(false);
		expect(L.setRow(m, 'nope', true)).toBe(m);
		const c = L.setColumn(m, 'push', true);
		expect(c.a.push && c.b.push).toBe(true);
		expect(c.a.email).toBe(false);
		const partial = { a: { email: false }, b: { email: false, push: false } };
		expect(L.setColumn(partial, 'push', true).a).toEqual({ email: false });
		expect(L.countEnabled(L.setAll(m, true))).toBe(6);
		expect(L.countEnabled(m)).toBe(0);
	});
});

describe('quiet hours', () => {
	const q = { enabled: true, start: '22:00', end: '07:00' };

	it('validates times', () => {
		expect(L.isValidTime('00:00')).toBe(true);
		expect(L.isValidTime('23:59')).toBe(true);
		expect(L.isValidTime('24:00')).toBe(false);
		expect(L.isValidTime('7:00')).toBe(false);
		expect(L.isValidTime('')).toBe(false);
		expect(L.timeToMinutes('01:30')).toBe(90);
		expect(L.timeToMinutes('bad')).toBeNaN();
	});

	it('validates a schedule', () => {
		expect(L.validateQuietHours(q)).toBe('');
		expect(L.validateQuietHours({ ...q, enabled: false, start: '' })).toBe('');
		expect(L.validateQuietHours({ ...q, start: '' })).toBe(L.QUIET_MESSAGES.invalid);
		expect(L.validateQuietHours({ ...q, end: 'x' })).toBe(L.QUIET_MESSAGES.invalid);
		expect(L.validateQuietHours({ ...q, end: '22:00' })).toBe(L.QUIET_MESSAGES.same);
	});

	it('knows when a time is quiet, across midnight and within a day', () => {
		expect(L.isQuietAt(q, '23:30')).toBe(true);
		expect(L.isQuietAt(q, '03:00')).toBe(true);
		expect(L.isQuietAt(q, '07:00')).toBe(false);
		expect(L.isQuietAt(q, '12:00')).toBe(false);
		expect(L.isQuietAt(q, '22:00')).toBe(true);
		const day = { enabled: true, start: '09:00', end: '17:00' };
		expect(L.isQuietAt(day, '09:00')).toBe(true);
		expect(L.isQuietAt(day, '17:00')).toBe(false);
		expect(L.isQuietAt({ ...q, enabled: false }, '23:30')).toBe(false);
		expect(L.isQuietAt({ ...q, start: '' }, '23:30')).toBe(false);
		expect(L.isQuietAt(q, 'nonsense')).toBe(false);
	});

	it('measures and describes duration', () => {
		expect(L.quietDuration(q)).toBe(9 * 60);
		expect(L.quietDuration({ enabled: true, start: '09:00', end: '17:30' })).toBe(510);
		expect(L.quietDuration({ ...q, enabled: false })).toBe(0);
		expect(L.quietDuration({ ...q, end: '22:00' })).toBe(0);
		expect(L.describeDuration(570)).toBe('9 h 30 min');
		expect(L.describeDuration(60)).toBe('1 h');
		expect(L.describeDuration(45)).toBe('45 min');
		expect(L.describeDuration(0)).toBe('');
	});
});

describe('api key scopes', () => {
	const avail = ['users:read', 'users:write', 'billing:read'];

	it('normalizes: dedupes, drops unknown, orders', () => {
		expect(L.normalizeScopes(['billing:read', 'users:read', 'users:read', 'x'], avail)).toEqual([
			'users:read',
			'billing:read'
		]);
		expect(L.normalizeScopes([], avail)).toEqual([]);
	});

	it('toggles with read/write implication', () => {
		expect(L.toggleScope([], 'users:write', avail)).toEqual(['users:read', 'users:write']);
		expect(L.toggleScope(['users:read', 'users:write'], 'users:read', avail)).toEqual([]);
		expect(L.toggleScope(['users:read', 'users:write'], 'users:write', avail)).toEqual([
			'users:read'
		]);
		expect(L.toggleScope([], 'billing:read', avail)).toEqual(['billing:read']);
		expect(L.toggleScope(['billing:read'], 'billing:read', avail)).toEqual([]);
		expect(L.toggleScope(['users:read'], 'nope', avail)).toEqual(['users:read']);
	});

	it('does not invent a read scope that is not available', () => {
		expect(L.toggleScope([], 'x:write', ['x:write'])).toEqual(['x:write']);
	});

	it('checks coverage: write grants read', () => {
		expect(L.scopesCover(['users:write'], 'users:read')).toBe(true);
		expect(L.scopesCover(['users:read'], 'users:write')).toBe(false);
		expect(L.scopesCover(['users:read'], 'users:read')).toBe(true);
		expect(L.scopesCover([], 'users:read')).toBe(false);
		expect(L.scopesCover(['billing:read'], 'users:read')).toBe(false);
	});

	it('summarizes scopes', () => {
		expect(L.summarizeScopes([], avail)).toBe('No access');
		expect(L.summarizeScopes(avail, avail)).toBe('Full access');
		expect(L.summarizeScopes(['users:read'], avail)).toBe('Read only: 1 scope');
		expect(L.summarizeScopes(['users:read', 'billing:read'], avail)).toBe('Read only: 2 scopes');
		expect(L.summarizeScopes(['users:read', 'users:write'], avail)).toBe('2 scopes');
		expect(L.summarizeScopes(['users:write'], avail)).toBe('1 scope');
	});
});

describe('api key names, masking and secrets', () => {
	it('validates names', () => {
		expect(L.validateKeyName('', [])).toBe(L.KEY_MESSAGES.required);
		expect(L.validateKeyName('   ', [])).toBe(L.KEY_MESSAGES.required);
		expect(L.validateKeyName('x'.repeat(61), [])).toBe(L.KEY_MESSAGES.tooLong);
		expect(L.validateKeyName('x'.repeat(60), [])).toBe('');
		expect(L.validateKeyName('CI', ['ci '])).toBe(L.KEY_MESSAGES.taken);
		expect(L.validateKeyName('CI', ['deploy'])).toBe('');
	});

	it('masks secrets', () => {
		expect(L.maskKey('nk_live_abcdefghijklmnop1234')).toBe('nk_live••••••••1234');
		expect(L.maskKey('short')).toBe('•'.repeat(8));
		expect(L.maskKey('a'.repeat(30), 2, 2)).toBe('aa••••••••aa');
		expect(L.maskKey('abcdefghijklmnopqrst')).not.toContain('klmn');
		expect(L.maskKey('x'.repeat(10))).toBe('•'.repeat(10));
		expect(L.maskFromParts('nk_', 'wxyz')).toBe('nk_••••••••wxyz');
	});

	it('formats a secret from bytes', () => {
		expect(L.formatApiKeySecret(new Uint8Array([0, 15, 255]))).toBe('nk_live_000fff');
		expect(L.formatApiKeySecret(new Uint8Array([1]), 'sk_')).toBe('sk_01');
	});
});

describe('expiry and dates', () => {
	it('computes expiry', () => {
		expect(L.computeExpiry('never', NOW)).toBeNull();
		expect(L.computeExpiry('bogus', NOW)).toBeNull();
		expect(L.computeExpiry('30', NOW)).toBe('2026-04-14T12:00:00.000Z');
		expect(L.computeExpiry('365', new Date(NOW))).toBe('2027-03-15T12:00:00.000Z');
	});

	it('classifies expiry', () => {
		expect(L.expiryStatus(null, NOW)).toBe('never');
		expect(L.expiryStatus(undefined, NOW)).toBe('never');
		expect(L.expiryStatus('garbage', NOW)).toBe('never');
		expect(L.expiryStatus('2026-03-15T11:00:00Z', NOW)).toBe('expired');
		expect(L.expiryStatus('2026-03-15T12:00:00Z', NOW)).toBe('expired');
		expect(L.expiryStatus('2026-03-20T12:00:00Z', NOW)).toBe('expiring');
		expect(L.expiryStatus('2026-03-22T12:00:00Z', NOW)).toBe('expiring');
		expect(L.expiryStatus('2026-03-23T12:00:00Z', NOW)).toBe('active');
		expect(L.expiryStatus('2026-03-23T12:00:00Z', NOW, 30)).toBe('expiring');
	});

	it('formats last used relatively', () => {
		expect(L.formatLastUsed(null, NOW)).toBe('Never used');
		expect(L.formatLastUsed(undefined, NOW, 'en', 'Nie')).toBe('Nie');
		expect(L.formatLastUsed('junk', NOW)).toBe('Never used');
		expect(L.formatLastUsed('2026-03-14T12:00:00Z', NOW)).toBe('yesterday');
		expect(L.formatLastUsed('2026-03-12T12:00:00Z', NOW)).toBe('3 days ago');
		expect(L.formatLastUsed('2026-03-15T09:00:00Z', NOW)).toBe('3 hours ago');
		expect(L.formatLastUsed('2026-03-15T11:30:00Z', NOW)).toBe('30 minutes ago');
		expect(L.formatLastUsed('2026-03-15T12:30:00Z', NOW)).toBe('this minute');
		expect(L.formatLastUsed('2026-03-12T12:00:00Z', NOW, 'de')).toBe('vor 3 Tagen');
	});

	it('formats dates in a fixed zone', () => {
		expect(L.formatSettingsDate('2026-03-15T23:30:00Z', 'en-US', 'UTC')).toBe('Mar 15, 2026');
		expect(L.formatSettingsDate('2026-03-15T23:30:00Z', 'en-US', 'Asia/Tokyo')).toBe(
			'Mar 16, 2026'
		);
		expect(L.formatSettingsDate('2026-03-15T23:30:00Z', 'en-US', 'Nope/Zone')).toBe('Mar 15, 2026');
		expect(L.formatSettingsDate('2026-03-15T23:30:00Z', 'en-US', 'UTC', 'long')).toBe(
			'March 15, 2026'
		);
		expect(L.formatSettingsDate('bad')).toBe('');
		expect(L.formatSettingsDateTime('2026-03-15T23:30:00Z', 'en-US', 'UTC')).toMatch(
			/Mar 15, 2026.*11:30/
		);
		expect(L.formatSettingsDateTime('bad')).toBe('');
		expect(L.formatSettingsDateTime('2026-03-15T23:30:00Z', 'en-US', 'x/y')).toMatch(/11:30/);
	});
});

describe('webhooks', () => {
	const M = L.WEBHOOK_MESSAGES;

	it('validates URLs', () => {
		expect(L.validateWebhookUrl('')).toBe(M.urlRequired);
		expect(L.validateWebhookUrl('   ')).toBe(M.urlRequired);
		expect(L.validateWebhookUrl('not a url')).toBe(M.urlInvalid);
		expect(L.validateWebhookUrl('ftp://example.com/x')).toBe(M.urlInvalid);
		expect(L.validateWebhookUrl('javascript:alert(1)')).toBe(M.urlInvalid);
		expect(L.validateWebhookUrl('http://example.com/x')).toBe(M.urlHttps);
		expect(L.validateWebhookUrl('https://example.com/hooks')).toBe('');
		expect(L.validateWebhookUrl(' https://example.com/hooks ')).toBe('');
		expect(L.validateWebhookUrl('https://user:pw@example.com/')).toBe(M.urlCredentials);
		expect(L.validateWebhookUrl('https://user@example.com/')).toBe(M.urlCredentials);
		expect(L.validateWebhookUrl('https://example.com/' + 'a'.repeat(2100))).toBe(M.urlLong);
	});

	it('allows local http only when asked', () => {
		expect(L.validateWebhookUrl('http://localhost:3000/h')).toBe(M.urlHttps);
		expect(L.validateWebhookUrl('http://localhost:3000/h', { allowLocalHttp: true })).toBe('');
		expect(L.validateWebhookUrl('http://127.0.0.1/h', { allowLocalHttp: true })).toBe('');
		expect(L.validateWebhookUrl('http://example.com/h', { allowLocalHttp: true })).toBe(M.urlHttps);
	});

	it('validates a draft', () => {
		expect(L.validateWebhook({ url: 'https://a.co', events: ['x'] })).toEqual({});
		expect(L.validateWebhook({ url: '', events: [] })).toEqual({
			url: M.urlRequired,
			events: M.eventsRequired
		});
		expect(L.validateWebhook({ url: 'https://a.co', events: [] })).toEqual({
			events: M.eventsRequired
		});
	});

	it('toggles events in available order', () => {
		const avail = ['a', 'b', 'c'];
		expect(L.toggleEvent([], 'b', avail)).toEqual(['b']);
		expect(L.toggleEvent(['c'], 'a', avail)).toEqual(['a', 'c']);
		expect(L.toggleEvent(['a', 'b'], 'a', avail)).toEqual(['b']);
		expect(L.toggleEvent(['zzz'], 'a', avail)).toEqual(['a']);
	});

	it('maps delivery status to words', () => {
		expect(L.deliveryStatus(null)).toEqual({ tone: 'neutral', label: 'Pending' });
		expect(L.deliveryStatus(undefined).label).toBe('Pending');
		expect(L.deliveryStatus(0).label).toBe('Pending');
		expect(L.deliveryStatus(200)).toEqual({ tone: 'success', label: 'Delivered' });
		expect(L.deliveryStatus(299).tone).toBe('success');
		expect(L.deliveryStatus(301)).toEqual({ tone: 'warning', label: 'Redirected' });
		expect(L.deliveryStatus(404)).toEqual({ tone: 'danger', label: 'Failed' });
		expect(L.deliveryStatus(500).tone).toBe('danger');
	});

	const d = (id: string, status: number | null, at: string) => ({ id, event: 'e', status, at });

	it('sorts deliveries newest first without mutating', () => {
		const list = [d('1', 200, '2026-03-01T00:00:00Z'), d('2', 200, '2026-03-03T00:00:00Z')];
		expect(L.sortDeliveries(list).map((x) => x.id)).toEqual(['2', '1']);
		expect(list[0].id).toBe('1');
	});

	it('judges endpoint health from finished deliveries', () => {
		expect(L.endpointHealth([])).toBe('no-data');
		expect(L.endpointHealth([d('1', null, '2026-03-01T00:00:00Z')])).toBe('no-data');
		expect(L.endpointHealth([d('1', 200, '2026-03-01T00:00:00Z')])).toBe('healthy');
		expect(
			L.endpointHealth([d('1', 500, '2026-03-02T00:00:00Z'), d('2', 200, '2026-03-01T00:00:00Z')])
		).toBe('degraded');
		expect(
			L.endpointHealth([d('1', 500, '2026-03-02T00:00:00Z'), d('2', 404, '2026-03-01T00:00:00Z')])
		).toBe('failing');
		// An old failure outside the window does not count.
		const many = [
			d('old', 500, '2026-01-01T00:00:00Z'),
			...[1, 2, 3].map((n) => d(String(n), 200, `2026-03-0${n}T00:00:00Z`))
		];
		expect(L.endpointHealth(many, 3)).toBe('healthy');
	});
});

describe('cookie consent', () => {
	const cats = L.DEFAULT_CATEGORIES;

	it('starts with only necessary on', () => {
		expect(L.defaultConsent(cats)).toEqual({ necessary: true, analytics: false, marketing: false });
		expect(L.rejectAll(cats)).toEqual(L.defaultConsent(cats));
		expect(L.acceptAll(cats)).toEqual({ necessary: true, analytics: true, marketing: true });
	});

	it('sets a category but never a necessary or unknown one', () => {
		const s = L.defaultConsent(cats);
		expect(L.setConsent(s, cats, 'analytics', true).analytics).toBe(true);
		expect(L.setConsent(s, cats, 'necessary', false)).toBe(s);
		expect(L.setConsent(s, cats, 'ghost', true)).toBe(s);
	});

	it('normalizes: unknown dropped, necessary forced, gaps off, truthy only', () => {
		expect(L.normalizeConsent({ analytics: true, ghost: true, necessary: false }, cats)).toEqual({
			necessary: true,
			analytics: true,
			marketing: false
		});
		expect(L.normalizeConsent(null, cats)).toEqual(L.defaultConsent(cats));
		expect(L.normalizeConsent({ analytics: 'yes' as never }, cats).analytics).toBe(false);
	});

	it('summarizes', () => {
		expect(L.consentSummary(L.defaultConsent(cats), cats)).toBe('Only necessary cookies');
		expect(L.consentSummary(L.acceptAll(cats), cats)).toBe('All cookies');
		expect(L.consentSummary({ ...L.defaultConsent(cats), analytics: true }, cats)).toBe(
			'1 of 2 optional categories'
		);
		expect(L.consentSummary({}, [{ id: 'necessary', label: 'N', necessary: true }])).toBe(
			'Only necessary cookies'
		);
	});

	it('round-trips through storage and rejects bad data', () => {
		const state = { necessary: true, analytics: true, marketing: false };
		const raw = L.serializeConsent(state, NOW, 2);
		expect(JSON.parse(raw)).toEqual({
			version: 2,
			decidedAt: '2026-03-15T12:00:00.000Z',
			choices: state
		});
		expect(L.parseConsent(raw, cats, 2)).toEqual(state);
		expect(L.parseConsent(raw, cats, 3)).toBeNull();
		expect(L.parseConsent(null, cats)).toBeNull();
		expect(L.parseConsent('', cats)).toBeNull();
		expect(L.parseConsent('{not json', cats)).toBeNull();
		expect(L.parseConsent('null', cats)).toBeNull();
		expect(L.parseConsent('"str"', cats)).toBeNull();
		expect(L.parseConsent('{"version":1}', cats)).toBeNull();
		expect(L.parseConsent('{"version":1,"choices":5}', cats)).toBeNull();
		expect(L.serializeConsent(state, NOW)).toContain('"version":1');
	});

	it('decides when to ask', () => {
		const raw = L.serializeConsent(L.acceptAll(cats), NOW);
		expect(L.needsConsent(raw, cats)).toBe(false);
		expect(L.needsConsent(null, cats)).toBe(true);
		expect(L.needsConsent(raw, cats, 9)).toBe(true);
	});
});

describe('privacy requests', () => {
	it('allows a request only when none is in flight', () => {
		for (const s of ['idle', 'ready', 'failed', 'cancelled'] as const)
			expect(L.canRequest(s)).toBe(true);
		for (const s of ['pending', 'processing'] as const) expect(L.canRequest(s)).toBe(false);
	});

	it('allows cancelling only a pending request', () => {
		expect(L.canCancel('pending')).toBe(true);
		for (const s of ['idle', 'processing', 'ready', 'failed', 'cancelled'] as const)
			expect(L.canCancel(s)).toBe(false);
	});

	it('names every status', () => {
		expect(L.requestStatusInfo('idle')).toEqual({ tone: 'neutral', label: 'Not requested' });
		expect(L.requestStatusInfo('pending').label).toBe('Requested');
		expect(L.requestStatusInfo('processing').label).toBe('In progress');
		expect(L.requestStatusInfo('ready').tone).toBe('success');
		expect(L.requestStatusInfo('failed').tone).toBe('danger');
		expect(L.requestStatusInfo('cancelled').label).toBe('Cancelled');
	});

	it('confirms the delete phrase', () => {
		expect(L.isDeleteConfirmed('DELETE', 'DELETE')).toBe(true);
		expect(L.isDeleteConfirmed('  delete ', 'DELETE')).toBe(true);
		expect(L.isDeleteConfirmed('DELET', 'DELETE')).toBe(false);
		expect(L.isDeleteConfirmed('', '')).toBe(false);
	});

	it('counts days left', () => {
		expect(L.settingsDaysUntil('2026-03-18T12:00:00Z', NOW)).toBe(3);
		expect(L.settingsDaysUntil('2026-03-18T13:00:00Z', NOW)).toBe(4);
		expect(L.settingsDaysUntil('2026-03-01T00:00:00Z', NOW)).toBe(0);
		expect(L.settingsDaysUntil(null, NOW)).toBeNull();
		expect(L.settingsDaysUntil('bad', NOW)).toBeNull();
	});
});

describe('language and region', () => {
	it('validates time zones and locales', () => {
		expect(L.isValidTimeZone('Europe/Paris')).toBe(true);
		expect(L.isValidTimeZone('UTC')).toBe(true);
		expect(L.isValidTimeZone('Mars/Olympus')).toBe(false);
		expect(L.isValidTimeZone('')).toBe(false);
		expect(L.resolveSettingsLocale('de-de')).toBe('de-DE');
		expect(L.resolveSettingsLocale('not a locale!!')).toBe('en-US');
		expect(L.resolveSettingsLocale('', 'fr')).toBe('fr');
	});

	it('names zones', () => {
		expect(L.zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
		expect(L.zoneCity('UTC')).toBe('UTC');
		expect(L.zoneOffsetLabel('UTC', NOW)).toBe('UTC+00:00');
		expect(L.zoneOffsetLabel('Asia/Kolkata', NOW)).toBe('UTC+05:30');
		expect(L.zoneOffsetLabel('America/New_York', NOW)).toBe('UTC-04:00');
		expect(L.zoneOffsetLabel('America/New_York', '2026-01-15T12:00:00Z')).toBe('UTC-05:00');
		expect(L.zoneOffsetLabel('Nope/Zone', NOW)).toBe('UTC');
		expect(L.zoneOffsetLabel('UTC', 'bad')).toBe('UTC');
		expect(L.offsetMinutes('UTC-05:30')).toBe(-330);
		expect(L.offsetMinutes('UTC+01:00')).toBe(60);
		expect(L.offsetMinutes('UTC')).toBe(0);
	});

	it('builds ordered zone options and drops invalid zones', () => {
		const opts = L.zoneOptions(
			['Asia/Tokyo', 'Nope/Zone', 'UTC', 'America/New_York', 'Europe/Paris'],
			NOW
		);
		expect(opts.map((o) => o.value)).toEqual([
			'America/New_York',
			'UTC',
			'Europe/Paris',
			'Asia/Tokyo'
		]);
		expect(opts[0].label).toBe('(UTC-04:00) New York');
		expect(opts[1].label).toBe('(UTC+00:00) UTC');
		expect(L.zoneOptions(L.TIME_ZONES, NOW).length).toBe(L.TIME_ZONES.length);
	});

	it('previews with Intl', () => {
		const base = { ...L.DEFAULT_REGION, timeZone: 'America/New_York' };
		const us = L.regionPreview(base, NOW);
		expect(us.date).toBe('Mar 15, 2026');
		expect(us.time).toMatch(/8:00\sAM/);
		expect(us.number).toBe('1,234,567.891');
		expect(us.currency).toBe('$1,234.50');
		expect(us.percent).toBe('26%');
		expect(us.timeZone).toBe('America/New_York');

		const de = L.regionPreview(
			{ ...base, language: 'de-DE', currency: 'eur', hourCycle: '24' },
			NOW
		);
		expect(de.number).toBe('1.234.567,891');
		expect(de.currency).toMatch(/1\.234,50\s€/);
		expect(de.time).toMatch(/^08:00/);

		const mixed = L.regionPreview({ ...base, numberLocale: 'fr-FR' }, NOW);
		expect(mixed.date).toBe('Mar 15, 2026');
		expect(mixed.numberLocale).toBe('fr-FR');
		expect(mixed.number).not.toBe(us.number);

		expect(L.regionPreview({ ...base, hourCycle: '12', language: 'de-DE' }, NOW).time).toMatch(
			/AM|vorm/i
		);
		expect(L.regionPreview({ ...base, dateStyle: 'full' }, NOW).date).toBe(
			'Sunday, March 15, 2026'
		);
		expect(L.regionPreview({ ...base, dateStyle: 'weird' as never }, NOW).date).toBe(
			'Mar 15, 2026'
		);
	});

	it('survives bad input', () => {
		const p = L.regionPreview(
			{ ...L.DEFAULT_REGION, language: '!!', timeZone: 'Nope', currency: 'xx', numberLocale: '??' },
			NOW
		);
		expect(p.locale).toBe('en-US');
		expect(p.timeZone).toBe('UTC');
		expect(p.currency).toBe('$1,234.50');
		expect(p.numberLocale).toBe('en-US');
		const bad = L.regionPreview(L.DEFAULT_REGION, 'not a date');
		expect(bad.date).toBe('');
		expect(bad.time).toBe('');
		expect(bad.number).toBe('1,234,567.891');
	});
});

describe('integrations', () => {
	const mk = (id: string, name: string, status: L.IntegrationStatus): L.Integration => ({
		id,
		name,
		description: `${name} sync`,
		status,
		permissions: []
	});

	it('maps statuses to words and tones', () => {
		expect(L.integrationStatusInfo('connected')).toEqual({ tone: 'success', label: 'Connected' });
		expect(L.integrationStatusInfo('error').tone).toBe('danger');
		expect(L.integrationStatusInfo('pending').label).toBe('Connecting');
		expect(L.integrationStatusInfo('disconnected').label).toBe('Not connected');
	});

	it('picks the action', () => {
		expect(L.integrationAction('connected')).toBe('disconnect');
		expect(L.integrationAction('error')).toBe('reconnect');
		expect(L.integrationAction('disconnected')).toBe('connect');
		expect(L.integrationAction('pending')).toBeNull();
	});

	it('sorts by attention, then name, without mutating', () => {
		const items = [
			mk('1', 'Zed', 'disconnected'),
			mk('2', 'Bee', 'connected'),
			mk('3', 'Ant', 'connected'),
			mk('4', 'Cat', 'error'),
			mk('5', 'Dog', 'pending')
		];
		expect(L.sortIntegrations(items).map((i) => i.name)).toEqual([
			'Cat',
			'Ant',
			'Bee',
			'Dog',
			'Zed'
		]);
		expect(items[0].name).toBe('Zed');
	});

	it('filters and counts', () => {
		const items = [mk('1', 'Slack', 'connected'), mk('2', 'GitHub', 'disconnected')];
		expect(L.filterIntegrations(items, '')).toHaveLength(2);
		expect(L.filterIntegrations(items, '  slack ').map((i) => i.id)).toEqual(['1']);
		expect(L.filterIntegrations(items, 'SYNC')).toHaveLength(2);
		expect(L.filterIntegrations(items, 'zzz')).toEqual([]);
		expect(L.countConnected(items)).toBe(1);
		expect(L.countConnected([])).toBe(0);
	});
});

describe('settings sections', () => {
	const sections = [
		{ id: 'a', label: 'A' },
		{ id: 'b', label: 'B' },
		{ id: 'c c', label: 'C' }
	];

	it('resolves the section', () => {
		expect(L.resolveSection('b', sections)).toBe('b');
		expect(L.resolveSection('zzz', sections)).toBe('a');
		expect(L.resolveSection(null, sections)).toBe('a');
		expect(L.resolveSection(undefined, sections)).toBe('a');
		expect(L.resolveSection('x', [])).toBe('');
	});

	it('reads a hash', () => {
		expect(L.sectionFromHash('#b', sections)).toBe('b');
		expect(L.sectionFromHash('b', sections)).toBe('b');
		expect(L.sectionFromHash('#c%20c', sections)).toBe('c c');
		expect(L.sectionFromHash('#nope', sections)).toBeNull();
		expect(L.sectionFromHash('', sections)).toBeNull();
		expect(L.sectionFromHash('#%E0%A4%A', sections)).toBeNull();
	});

	it('moves with wrap-around', () => {
		expect(L.moveSection('a', sections, 1)).toBe('b');
		expect(L.moveSection('c c', sections, 1)).toBe('a');
		expect(L.moveSection('a', sections, -1)).toBe('c c');
		expect(L.moveSection('b', sections, 'first')).toBe('a');
		expect(L.moveSection('b', sections, 'last')).toBe('c c');
		expect(L.moveSection('unknown', sections, 1)).toBe('b');
		expect(L.moveSection('a', [], 1)).toBe('');
	});
});
