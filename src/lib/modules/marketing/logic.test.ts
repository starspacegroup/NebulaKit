import { describe, expect, it } from 'vitest';
import {
	annualSavings,
	bestSavingsPercent,
	billedAmount,
	canAutoplay,
	charactersLeft,
	clampSlideIndex,
	CONTACT_FIELD_ORDER,
	countUpValue,
	easeCount,
	featureStatus,
	filterFaq,
	formatPlanPrice,
	formatStat,
	isFreePlan,
	isRotating,
	isValidMarketingEmail,
	monthlyEquivalent,
	orderedErrors,
	resultsAnnouncement,
	stepSlide,
	toggleFaqOpen,
	validateContact,
	validateNewsletter,
	type AutoplayState
} from './logic';

const plan = { monthly: 20, annual: 192 };

describe('pricing', () => {
	it('formats whole amounts without cents and others with', () => {
		expect(formatPlanPrice(19)).toBe('$19');
		expect(formatPlanPrice(15.5)).toBe('$15.50');
		expect(formatPlanPrice(0)).toBe('$0');
	});

	it('honours currency and locale', () => {
		expect(formatPlanPrice(19, 'EUR', 'de-DE').replace(/\s/g, ' ')).toBe('19 €');
		expect(formatPlanPrice(1200, 'JPY', 'ja-JP')).toContain('1,200');
	});

	it('gives the monthly equivalent of each interval', () => {
		expect(monthlyEquivalent(plan, 'monthly')).toBe(20);
		expect(monthlyEquivalent(plan, 'annual')).toBe(16);
	});

	it('gives the amount billed each period', () => {
		expect(billedAmount(plan, 'monthly')).toBe(20);
		expect(billedAmount(plan, 'annual')).toBe(192);
	});

	it('computes the annual saving', () => {
		expect(annualSavings(plan)).toEqual({ amount: 48, percent: 20 });
	});

	it('never reports a negative saving, and handles free plans', () => {
		expect(annualSavings({ monthly: 10, annual: 150 })).toEqual({ amount: 0, percent: 0 });
		expect(annualSavings({ monthly: 0, annual: 0 })).toEqual({ amount: 0, percent: 0 });
	});

	it('finds the best saving', () => {
		expect(
			bestSavingsPercent([plan, { monthly: 10, annual: 100 }, { monthly: 0, annual: 0 }])
		).toBe(20);
		expect(bestSavingsPercent([])).toBe(0);
	});

	it('knows a free plan', () => {
		expect(isFreePlan({ monthly: 0, annual: 0 })).toBe(true);
		expect(isFreePlan(plan)).toBe(false);
		expect(isFreePlan({ monthly: 0, annual: 5 })).toBe(false);
	});

	it('words feature status, with overrides', () => {
		expect(featureStatus(true)).toBe('Included:');
		expect(featureStatus(false)).toBe('Not included:');
		expect(featureStatus(true, 'Inclus :', 'Non inclus :')).toBe('Inclus :');
		expect(featureStatus(false, 'Inclus :', 'Non inclus :')).toBe('Non inclus :');
	});
});

describe('email', () => {
	it.each(['a@b.co', ' a.b+c@sub.example.org ', 'x@y.z'])('accepts %s', (v) => {
		expect(isValidMarketingEmail(v)).toBe(true);
	});
	it.each(['', 'a', 'a@b', 'a@.com', 'a b@c.de', '@b.co', 'a@b.', `${'a'.repeat(250)}@b.co`])(
		'rejects %j',
		(v) => {
			expect(isValidMarketingEmail(v)).toBe(false);
		}
	);
});

describe('validateNewsletter', () => {
	const ok = { email: 'a@b.co', consent: true, website: '' };

	it('passes a good submission', () => {
		expect(validateNewsletter(ok)).toEqual({ errors: {}, valid: true, spam: false });
	});

	it('requires an email, then a valid one', () => {
		expect(validateNewsletter({ ...ok, email: '  ' }).errors.email).toBe('This field is required.');
		expect(validateNewsletter({ ...ok, email: 'nope' }).errors.email).toBe(
			'Enter a valid email address.'
		);
	});

	it('requires consent unless told otherwise', () => {
		const r = validateNewsletter({ ...ok, consent: false });
		expect(r.errors.consent).toBe('Please agree to continue.');
		expect(r.valid).toBe(false);
		expect(validateNewsletter({ ...ok, consent: false }, { requireConsent: false }).valid).toBe(
			true
		);
	});

	it('flags the honeypot', () => {
		expect(validateNewsletter({ ...ok, website: 'http://spam' }).spam).toBe(true);
		expect(validateNewsletter({ ...ok, website: '   ' }).spam).toBe(false);
	});

	it('takes translated messages', () => {
		const r = validateNewsletter({ ...ok, email: '' }, { messages: { required: 'Requis.' } });
		expect(r.errors.email).toBe('Requis.');
	});
});

describe('validateContact', () => {
	const ok = { name: 'Ada', email: 'ada@x.io', topic: 'sales', message: 'Hello there, friend.' };

	it('passes a good form', () => {
		expect(validateContact(ok)).toEqual({});
	});

	it('flags every empty field', () => {
		expect(validateContact({ name: ' ', email: '', topic: '', message: '' })).toEqual({
			name: 'This field is required.',
			email: 'This field is required.',
			topic: 'This field is required.',
			message: 'This field is required.'
		});
	});

	it('checks the email shape', () => {
		expect(validateContact({ ...ok, email: 'x' }).email).toBe('Enter a valid email address.');
	});

	it('checks message length at both ends', () => {
		expect(validateContact({ ...ok, message: 'short' }).message).toBe(
			'Use at least 10 characters.'
		);
		expect(validateContact({ ...ok, message: 'x'.repeat(11) }, { maxMessage: 10 }).message).toBe(
			'Use 10 characters or fewer.'
		);
		expect(
			validateContact({ ...ok, message: 'x'.repeat(5) }, { minMessage: 5 }).message
		).toBeUndefined();
		expect(validateContact({ ...ok, message: 'x'.repeat(1000) }).message).toBeUndefined();
		expect(validateContact({ ...ok, message: 'x'.repeat(1001) }).message).toBe(
			'Use 1000 characters or fewer.'
		);
	});
});

describe('orderedErrors and counter', () => {
	it('lists errors in field order, skipping blanks', () => {
		const list = orderedErrors({ message: 'm', name: 'n', email: '' }, CONTACT_FIELD_ORDER);
		expect(list).toEqual([
			['name', 'n'],
			['message', 'm']
		]);
	});

	it('counts characters left', () => {
		expect(charactersLeft(3, 10)).toEqual({ left: 7, over: false });
		expect(charactersLeft(10, 10)).toEqual({ left: 0, over: false });
		expect(charactersLeft(12, 10)).toEqual({ left: -2, over: true });
	});
});

describe('faq', () => {
	const items = [
		{ question: 'How do I reset my password?', answer: 'Use the Forgot link.' },
		{ question: 'Is there a free plan?', answer: 'Yes, forever.' },
		{ question: 'Café hours', answer: 'Nine to five.' }
	];

	it('returns everything for a blank query', () => {
		expect(filterFaq(items, '')).toBe(items);
		expect(filterFaq(items, '   ')).toBe(items);
	});

	it('matches every word, anywhere, ignoring case', () => {
		expect(filterFaq(items, 'PASSWORD reset')).toEqual([items[0]]);
		expect(filterFaq(items, 'forever free')).toEqual([items[1]]);
		expect(filterFaq(items, 'password forever')).toEqual([]);
	});

	it('ignores accents', () => {
		expect(filterFaq(items, 'cafe')).toEqual([items[2]]);
		expect(filterFaq(items, 'café')).toEqual([items[2]]);
	});

	it('announces results', () => {
		expect(resultsAnnouncement(3, '')).toBe('');
		expect(resultsAnnouncement(0, ' zzz ')).toBe('No questions match "zzz".');
		expect(resultsAnnouncement(1, 'a')).toBe('1 question matches.');
		expect(resultsAnnouncement(2, 'a')).toBe('2 questions match.');
		expect(resultsAnnouncement(0, 'a', { none: (q) => `Rien : ${q}` })).toBe('Rien : a');
		expect(resultsAnnouncement(2, 'a', { some: (n) => `${n} résultats` })).toBe('2 résultats');
	});

	it('toggles open ids', () => {
		expect(toggleFaqOpen([], 'a')).toEqual(['a']);
		expect(toggleFaqOpen(['a'], 'b')).toEqual(['a', 'b']);
		expect(toggleFaqOpen(['a', 'b'], 'a')).toEqual(['b']);
		expect(toggleFaqOpen(['a'], 'b', true)).toEqual(['b']);
		expect(toggleFaqOpen(['a'], 'a', true)).toEqual([]);
	});
});

describe('carousel', () => {
	it('wraps stepping', () => {
		expect(stepSlide(0, 1, 3)).toBe(1);
		expect(stepSlide(2, 1, 3)).toBe(0);
		expect(stepSlide(0, -1, 3)).toBe(2);
		expect(stepSlide(1, -7, 3)).toBe(0);
		expect(stepSlide(0, 1, 0)).toBe(0);
	});

	it('clamps an index', () => {
		expect(clampSlideIndex(5, 3)).toBe(2);
		expect(clampSlideIndex(-2, 3)).toBe(0);
		expect(clampSlideIndex(1.9, 3)).toBe(1);
		expect(clampSlideIndex(Number.NaN, 3)).toBe(0);
		expect(clampSlideIndex(2, 0)).toBe(0);
	});

	const base: AutoplayState = {
		interval: 3000,
		reducedMotion: false,
		paused: false,
		engaged: false,
		count: 3
	};

	it('only offers autoplay when it can run', () => {
		expect(canAutoplay(base)).toBe(true);
		expect(canAutoplay({ ...base, interval: 0 })).toBe(false);
		expect(canAutoplay({ ...base, reducedMotion: true })).toBe(false);
		expect(canAutoplay({ ...base, count: 1 })).toBe(false);
	});

	it('rotates unless paused, engaged or unable', () => {
		expect(isRotating(base)).toBe(true);
		expect(isRotating({ ...base, paused: true })).toBe(false);
		expect(isRotating({ ...base, engaged: true })).toBe(false);
		expect(isRotating({ ...base, reducedMotion: true })).toBe(false);
	});
});

describe('count-up', () => {
	it('eases from 0 to 1 and clamps', () => {
		expect(easeCount(0)).toBe(0);
		expect(easeCount(1)).toBe(1);
		expect(easeCount(-1)).toBe(0);
		expect(easeCount(2)).toBe(1);
		expect(easeCount(0.5)).toBeCloseTo(0.875);
	});

	it('is monotonic', () => {
		let last = -1;
		for (let t = 0; t <= 1; t += 0.1) {
			const v = easeCount(t);
			expect(v).toBeGreaterThanOrEqual(last);
			last = v;
		}
	});

	it('counts up to the target', () => {
		expect(countUpValue(100, 0, 1000)).toBe(0);
		expect(countUpValue(100, 500, 1000)).toBe(88);
		expect(countUpValue(100, 1000, 1000)).toBe(100);
		expect(countUpValue(100, 5000, 1000)).toBe(100);
		expect(countUpValue(100, 10, 0)).toBe(100);
	});

	it('keeps decimals', () => {
		expect(countUpValue(4.9, 500, 1000, 1)).toBe(4.3);
	});

	it('formats counts', () => {
		expect(formatStat(12345)).toBe('12,345');
		expect(formatStat(12345, { locale: 'de-DE' })).toBe('12.345');
		expect(formatStat(4.9, { decimals: 1 })).toBe('4.9');
		expect(formatStat(4, { decimals: 1 })).toBe('4.0');
		expect(formatStat(1_200_000, { compact: true })).toBe('1M');
		expect(formatStat(1_250_000, { compact: true, decimals: 1 })).toBe('1.3M');
	});
});
