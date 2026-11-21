import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
	TRAFFIC_CLASSES,
	classifyTraffic,
	emptySplit,
	percentOf,
	splitTotal,
	type TrafficSignals
} from '../../src/lib/utils/traffic-class';

const CHROME =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';

const real = (o: Partial<TrafficSignals> = {}): TrafficSignals => ({
	userAgent: CHROME,
	acceptLanguage: 'en-US,en;q=0.9',
	secFetch: 'none',
	...o
});

describe('classifyTraffic', () => {
	it('calls an ordinary browser visit probably real', () => {
		expect(classifyTraffic(real())).toBe('human');
		expect(
			classifyTraffic({ userAgent: FIREFOX, acceptLanguage: 'en', secFetch: 'cross-site' })
		).toBe('human');
	});

	it('knows crawlers, previews and monitors that name themselves', () => {
		for (const ua of [
			'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
			'Mozilla/5.0 AppleWebKit/537.36 (compatible; bingbot/2.0)',
			'facebookexternalhit/1.1',
			'Slackbot-LinkExpanding 1.0',
			'Mozilla/5.0 (compatible; AhrefsBot/7.0)',
			'Mozilla/5.0 (compatible; Yahoo! Slurp)',
			'UptimeRobot/2.0',
			'Mozilla/5.0 (compatible; GPTBot/1.1)'
		]) {
			expect(classifyTraffic(real({ userAgent: ua }))).toBe('bot');
		}
	});

	it('trusts Cloudflare when it has verified a bot', () => {
		expect(classifyTraffic(real({ verifiedBotCategory: 'Search Engine Crawler' }))).toBe('bot');
	});

	it('flags what does not say it is a bot but does not behave like a browser', () => {
		for (const ua of [
			null,
			'',
			'python-requests/2.31.0',
			'curl/8.4.0',
			'Go-http-client/2.0',
			'axios/1.6.0',
			'node-fetch/1.0',
			'okhttp/4.12.0',
			'Scrapy/2.11',
			'Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0 Playwright/1.45'
		]) {
			expect(classifyTraffic(real({ userAgent: ua }))).toBe('likely-bot');
		}
	});

	it('flags a browser that is missing the headers every browser sends', () => {
		expect(classifyTraffic(real({ acceptLanguage: null }))).toBe('likely-bot');
		expect(classifyTraffic(real({ acceptLanguage: '   ' }))).toBe('likely-bot');
		expect(classifyTraffic(real({ secFetch: null }))).toBe('likely-bot');
	});

	it('does not need Sec-Fetch from a browser that predates it', () => {
		const old = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/70.0.3538 Safari/537.36';
		expect(classifyTraffic({ userAgent: old, acceptLanguage: 'en', secFetch: null })).toBe('human');
		// Firefox and Safari send it too, but the rule only leans on Chrome's known version.
		expect(classifyTraffic({ userAgent: FIREFOX, acceptLanguage: 'en', secFetch: null })).toBe(
			'human'
		);
	});

	it('uses a Cloudflare bot score when the plan has one, and ignores a missing or zero score', () => {
		expect(classifyTraffic(real({ botScore: 5 }))).toBe('likely-bot');
		expect(classifyTraffic(real({ botScore: 29 }))).toBe('likely-bot');
		expect(classifyTraffic(real({ botScore: 30 }))).toBe('human');
		expect(classifyTraffic(real({ botScore: 0 }))).toBe('human');
		expect(classifyTraffic(real({ botScore: null }))).toBe('human');
	});

	it('property: always one of the three classes, and a named bot is a bot whatever else is sent', () => {
		const text = fc.option(fc.string({ maxLength: 80 }), { nil: null });
		fc.assert(
			fc.property(
				text,
				text,
				text,
				fc.option(fc.integer({ min: 0, max: 99 }), { nil: null }),
				(userAgent, acceptLanguage, secFetch, botScore) => {
					const c = classifyTraffic({ userAgent, acceptLanguage, secFetch, botScore });
					expect(TRAFFIC_CLASSES).toContain(c);
					const named = classifyTraffic({
						userAgent: `${userAgent ?? ''} Googlebot`,
						acceptLanguage,
						secFetch,
						botScore
					});
					expect(named).toBe('bot');
				}
			),
			{ numRuns: 200 }
		);
	});

	it('property: a real browser sending its usual headers is never called a bot', () => {
		fc.assert(
			fc.property(
				fc.constantFrom(CHROME, FIREFOX),
				fc.constantFrom('en', 'en-US,en;q=0.9', 'fr-FR', 'de;q=0.5'),
				fc.constantFrom('none', 'same-origin', 'cross-site', 'navigate'),
				(userAgent, acceptLanguage, secFetch) => {
					expect(classifyTraffic({ userAgent, acceptLanguage, secFetch })).toBe('human');
				}
			)
		);
	});
});

describe('split helpers', () => {
	it('totals and takes whole percents, and copes with nothing counted', () => {
		const split = { human: 70, likelyBot: 20, bot: 10 };
		expect(splitTotal(split)).toBe(100);
		expect(percentOf(split.human, split)).toBe(70);
		expect(percentOf(1, emptySplit())).toBe(0);
		expect(percentOf(1, { human: 1, likelyBot: 1, bot: 1 })).toBe(33);
	});
});
