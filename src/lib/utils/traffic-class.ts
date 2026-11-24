/**
 * Who a page view probably came from (docs/ADMIN_STATS.md, "Real visitors and bots").
 *
 * A guess, made from request headers that are read once and never stored: only the resulting
 * class lands in a counter. Three classes, a closed vocabulary:
 *
 *  - `bot`: it says so. A crawler, link-preview fetcher, monitor or SEO tool that names itself,
 *    or Cloudflare vouches for it as a verified bot.
 *  - `likely-bot`: it does not say so, but it does not behave like a browser. Automation
 *    (headless Chrome, Selenium), plain HTTP libraries, no User-Agent, or a "browser" missing
 *    headers every real browser sends.
 *  - `human`: everything else. "Probably real" is the honest label: a careful scraper that copies
 *    a browser's headers looks exactly like this.
 *
 * Pure so it can be tested without a browser or a database. Leans toward `human` when unsure:
 * calling a real visitor a bot hides them, calling a bot a visitor only adds a little noise.
 */

export const TRAFFIC_CLASSES = ['human', 'likely-bot', 'bot'] as const;
export type TrafficClass = (typeof TRAFFIC_CLASSES)[number];

/** How each class is named on the dashboard. */
export const TRAFFIC_CLASS_LABELS: Record<TrafficClass, string> = {
	human: 'Probably real',
	'likely-bot': 'Likely bots',
	bot: 'Known bots'
};

/** Names itself: crawlers, link previews, monitors, SEO tools. */
export const BOT_UA =
	/bot|crawler|spider|preview|facebookexternalhit|lighthouse|slurp|yandex|ahrefs|semrush|mediapartners|bingpreview|embedly|pingdom|uptime|monitor|headless/i;

/** Drives a browser or fetches pages with a library: not a person reading. */
const AUTOMATION_UA =
	/puppeteer|playwright|selenium|webdriver|phantomjs|chrome-lighthouse|python-requests|python-urllib|aiohttp|httpx|scrapy|go-http-client|okhttp|java\/|apache-httpclient|libwww|curl\/|wget\/|axios\/|node-fetch|undici|got \(|postmanruntime|insomnia|http_request|restsharp/i;

export interface TrafficSignals {
	userAgent: string | null;
	acceptLanguage: string | null;
	/** `Sec-Fetch-Site` (or `Sec-Fetch-Mode`): every modern browser sends one on a page load. */
	secFetch: string | null;
	/** Cloudflare: `request.cf.verifiedBotCategory`, set only for bots it has verified. */
	verifiedBotCategory?: string | null;
	/** Cloudflare Bot Management score, 1 (bot) to 99 (human). Only on plans that have it. */
	botScore?: number | null;
}

/** Chrome 76 (2019) started sending Sec-Fetch-* on every navigation. */
const SEC_FETCH_SINCE_CHROME = 80;

export function classifyTraffic(s: TrafficSignals): TrafficClass {
	if (s.verifiedBotCategory) return 'bot';
	const ua = (s.userAgent ?? '').trim();
	if (BOT_UA.test(ua)) return 'bot';
	if (!ua) return 'likely-bot';
	if (AUTOMATION_UA.test(ua)) return 'likely-bot';
	if (typeof s.botScore === 'number' && s.botScore > 0 && s.botScore < 30) return 'likely-bot';
	// A browser's User-Agent without the headers a browser always sends.
	if (/^Mozilla\//.test(ua)) {
		if (!(s.acceptLanguage ?? '').trim()) return 'likely-bot';
		const chrome = /Chrome\/(\d+)/.exec(ua);
		if (chrome && Number(chrome[1]) >= SEC_FETCH_SINCE_CHROME && !(s.secFetch ?? '').trim()) {
			return 'likely-bot';
		}
	}
	return 'human';
}

/** Totals per class, for the dashboard. */
export interface TrafficSplit {
	human: number;
	likelyBot: number;
	bot: number;
}

export function emptySplit(): TrafficSplit {
	return { human: 0, likelyBot: 0, bot: 0 };
}

export function splitTotal(split: TrafficSplit): number {
	return split.human + split.likelyBot + split.bot;
}

/** The share of all counted views in `part`, as a whole percent; 0 when there are none. */
export function percentOf(part: number, split: TrafficSplit): number {
	const total = splitTotal(split);
	return total === 0 ? 0 : Math.round((part / total) * 100);
}
