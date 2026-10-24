import { describe, expect, it } from 'vitest';
import { faqJsonLd, jsonLdScriptTag, serializeJsonLd } from './faq';
import { trustChecksNeedingWork, visibleTrustChecks, type TrustCheck } from './trust-badges';

describe('faqJsonLd', () => {
	it('copies question and answer text verbatim and drops empty items', () => {
		const ld = faqJsonLd([
			{ question: 'Is it free?', answer: 'The check is free.' },
			{ question: ' ', answer: 'x' },
			{ question: 'y', answer: '' }
		]);
		expect(ld['@type']).toBe('FAQPage');
		expect(ld.mainEntity).toEqual([
			{
				'@type': 'Question',
				name: 'Is it free?',
				acceptedAnswer: { '@type': 'Answer', text: 'The check is free.' }
			}
		]);
	});
});

describe('serializeJsonLd', () => {
	it('escapes characters that could close the script tag', () => {
		const s = serializeJsonLd({ a: '</script><b>&' });
		expect(s).not.toContain('<');
		expect(s).not.toContain('>');
		expect(s).not.toContain('&');
		expect(JSON.parse(s)).toEqual({ a: '</script><b>&' });
	});

	it('wraps in an ld+json script tag', () => {
		expect(jsonLdScriptTag({ a: 1 })).toBe('<script type="application/ld+json">{"a":1}</script>');
	});
});

describe('trust checks', () => {
	const now = new Date('2026-10-24T12:00:00Z');
	const base: TrustCheck = {
		label: 'SSL Labs A+',
		reportUrl: 'https://www.ssllabs.com/ssltest/analyze.html?d=example.com',
		measuredOn: '2026-10-20',
		passed: true
	};

	it('shows a passed, recent check with an https report', () => {
		expect(visibleTrustChecks([base], now)).toEqual([base]);
	});

	it('hides failed, stale, future, undated, unlabelled and non-https checks', () => {
		const bad: TrustCheck[] = [
			{ ...base, passed: false },
			{ ...base, measuredOn: '2026-01-01' },
			{ ...base, measuredOn: '2026-11-01' },
			{ ...base, measuredOn: 'last week' },
			{ ...base, measuredOn: '2026-02-31' },
			{ ...base, label: '  ' },
			{ ...base, reportUrl: 'http://example.com' },
			{ ...base, reportUrl: 'not a url' }
		];
		expect(visibleTrustChecks(bad, now)).toEqual([]);
		expect(trustChecksNeedingWork([base, ...bad], now)).toEqual(bad);
	});

	it('respects a custom max age and the default clock', () => {
		expect(visibleTrustChecks([base], now, 2)).toEqual([]);
		expect(
			visibleTrustChecks([{ ...base, measuredOn: new Date().toISOString().slice(0, 10) }])
		).toHaveLength(1);
		expect(trustChecksNeedingWork([{ ...base, measuredOn: '2000-01-01' }])).toHaveLength(1);
	});
});
