/**
 * Pure decisions behind the marketing modules: pricing maths and formatting,
 * form validation, FAQ filtering, carousel stepping and count-up easing.
 * Nothing here touches the DOM, the clock or storage.
 */

/* ----------------------------------------------------------------- pricing */

export type PlanInterval = 'monthly' | 'annual';

export interface MarketingPlan {
	id: string;
	name: string;
	description?: string;
	/** Price per month when billed monthly, in major units (19 = 19.00). */
	monthly: number;
	/** Price per year when billed annually, in major units. */
	annual: number;
	features: { text: string; included: boolean }[];
	highlighted?: boolean;
	/** Badge text for a highlighted plan, e.g. "Most popular". */
	badge?: string;
	cta?: string;
	href?: string;
}

/** Format a money amount with Intl. Whole amounts drop the cents. */
export function formatPlanPrice(amount: number, currency = 'USD', locale = 'en-US'): string {
	const whole = Number.isInteger(amount);
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency,
		minimumFractionDigits: whole ? 0 : 2,
		maximumFractionDigits: whole ? 0 : 2
	}).format(amount);
}

/** What the plan costs per month on the chosen interval. */
export function monthlyEquivalent(
	plan: Pick<MarketingPlan, 'monthly' | 'annual'>,
	interval: PlanInterval
): number {
	return interval === 'annual' ? plan.annual / 12 : plan.monthly;
}

/** What is billed each period: a month, or a year. */
export function billedAmount(
	plan: Pick<MarketingPlan, 'monthly' | 'annual'>,
	interval: PlanInterval
): number {
	return interval === 'annual' ? plan.annual : plan.monthly;
}

/** How much paying annually saves over twelve months of monthly billing. */
export function annualSavings(plan: Pick<MarketingPlan, 'monthly' | 'annual'>): {
	amount: number;
	percent: number;
} {
	const full = plan.monthly * 12;
	const amount = Math.max(0, full - plan.annual);
	const percent = full > 0 ? Math.round((amount / full) * 100) : 0;
	return { amount, percent };
}

/** The largest saving across the plans, for the toggle's "Save up to 20%" text. */
export function bestSavingsPercent(plans: Pick<MarketingPlan, 'monthly' | 'annual'>[]): number {
	return plans.reduce((best, plan) => Math.max(best, annualSavings(plan).percent), 0);
}

export function isFreePlan(plan: Pick<MarketingPlan, 'monthly' | 'annual'>): boolean {
	return plan.monthly === 0 && plan.annual === 0;
}

/** Text for one feature row that a screen reader can understand without the tick or dash. */
export function featureStatus(
	included: boolean,
	includedText = 'Included:',
	excludedText = 'Not included:'
): string {
	return included ? includedText : excludedText;
}

/* ------------------------------------------------------------ validation */

export type MarketingFieldErrors<K extends string = string> = Partial<Record<K, string>>;

const EMAIL = /^[^\s@]+@[^\s@.][^\s@]*\.[^\s@.]+$/;

export function isValidMarketingEmail(value: string): boolean {
	const v = value.trim();
	return v.length <= 254 && EMAIL.test(v);
}

export interface MarketingFormMessages {
	required: string;
	email: string;
	consent: string;
	tooLong: (max: number) => string;
	tooShort: (min: number) => string;
}

export const defaultFormMessages: MarketingFormMessages = {
	required: 'This field is required.',
	email: 'Enter a valid email address.',
	consent: 'Please agree to continue.',
	tooLong: (max) => `Use ${max} characters or fewer.`,
	tooShort: (min) => `Use at least ${min} characters.`
};

export interface NewsletterValues {
	email: string;
	consent: boolean;
	/** The honeypot. Humans never see it, so anything in it is a bot. */
	website: string;
}

export interface NewsletterResult {
	errors: MarketingFieldErrors<'email' | 'consent'>;
	valid: boolean;
	spam: boolean;
}

export function validateNewsletter(
	values: NewsletterValues,
	options: { requireConsent?: boolean; messages?: Partial<MarketingFormMessages> } = {}
): NewsletterResult {
	const m = { ...defaultFormMessages, ...options.messages };
	const errors: MarketingFieldErrors<'email' | 'consent'> = {};
	if (!values.email.trim()) errors.email = m.required;
	else if (!isValidMarketingEmail(values.email)) errors.email = m.email;
	if (options.requireConsent !== false && !values.consent) errors.consent = m.consent;
	const spam = values.website.trim() !== '';
	return { errors, valid: Object.keys(errors).length === 0, spam };
}

export interface ContactValues {
	name: string;
	email: string;
	topic: string;
	message: string;
}

export type ContactField = keyof ContactValues;

export const CONTACT_FIELD_ORDER: ContactField[] = ['name', 'email', 'topic', 'message'];

export function validateContact(
	values: ContactValues,
	options: {
		maxMessage?: number;
		minMessage?: number;
		messages?: Partial<MarketingFormMessages>;
	} = {}
): MarketingFieldErrors<ContactField> {
	const m = { ...defaultFormMessages, ...options.messages };
	const max = options.maxMessage ?? 1000;
	const min = options.minMessage ?? 10;
	const errors: MarketingFieldErrors<ContactField> = {};
	if (!values.name.trim()) errors.name = m.required;
	if (!values.email.trim()) errors.email = m.required;
	else if (!isValidMarketingEmail(values.email)) errors.email = m.email;
	if (!values.topic) errors.topic = m.required;
	const body = values.message.trim();
	if (!body) errors.message = m.required;
	else if (body.length < min) errors.message = m.tooShort(min);
	else if (values.message.length > max) errors.message = m.tooLong(max);
	return errors;
}

/** The errors as an ordered list for a summary: [field, message]. */
export function orderedErrors<K extends string>(
	errors: MarketingFieldErrors<K>,
	order: K[]
): [K, string][] {
	const out: [K, string][] = [];
	for (const key of order) {
		const message = errors[key];
		if (message) out.push([key, message]);
	}
	return out;
}

/** "3 characters left", "over by 2": the counter's text. */
export function charactersLeft(length: number, max: number): { left: number; over: boolean } {
	return { left: max - length, over: length > max };
}

/* ------------------------------------------------------------------- FAQ */

export interface FaqItem {
	id?: string;
	question: string;
	answer: string;
}

function fold(text: string): string {
	return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Keep items whose question or answer contains every word of the query. */
export function filterFaq<T extends FaqItem>(items: T[], query: string): T[] {
	const words = fold(query).split(/\s+/).filter(Boolean);
	if (words.length === 0) return items;
	return items.filter((item) => {
		const haystack = fold(`${item.question} ${item.answer}`);
		return words.every((w) => haystack.includes(w));
	});
}

/** The sentence a live region announces after a search. */
export function resultsAnnouncement(
	count: number,
	query: string,
	messages: { none?: (q: string) => string; some?: (n: number) => string } = {}
): string {
	if (!query.trim()) return '';
	if (count === 0) return (messages.none ?? ((q) => `No questions match "${q}".`))(query.trim());
	return (messages.some ?? ((n) => `${n} ${n === 1 ? 'question matches' : 'questions match'}.`))(
		count
	);
}

/** Open or close one id in a set of open ids. `single` keeps at most one open. */
export function toggleFaqOpen(open: string[], id: string, single = false): string[] {
	if (open.includes(id)) return open.filter((x) => x !== id);
	return single ? [id] : [...open, id];
}

/* -------------------------------------------------------------- carousel */

/** Step an index by `delta`, wrapping at both ends. */
export function stepSlide(index: number, delta: number, count: number): number {
	if (count <= 0) return 0;
	return (((index + delta) % count) + count) % count;
}

export function clampSlideIndex(index: number, count: number): number {
	if (count <= 0) return 0;
	return Math.min(Math.max(0, Math.trunc(index) || 0), count - 1);
}

export interface AutoplayState {
	/** Milliseconds per slide; 0 or less turns autoplay off. */
	interval: number;
	reducedMotion: boolean;
	/** The visitor pressed pause. */
	paused: boolean;
	/** The pointer is over the carousel or focus is inside it. */
	engaged: boolean;
	count: number;
}

/** Whether a carousel may be offered autoplay at all. Reduced motion never autoplays. */
export function canAutoplay(
	state: Pick<AutoplayState, 'interval' | 'reducedMotion' | 'count'>
): boolean {
	return state.interval > 0 && !state.reducedMotion && state.count > 1;
}

/** Whether the slides are rotating right now. */
export function isRotating(state: AutoplayState): boolean {
	return canAutoplay(state) && !state.paused && !state.engaged;
}

/* -------------------------------------------------------------- count-up */

export function easeCount(t: number): number {
	const x = Math.min(1, Math.max(0, t));
	return 1 - Math.pow(1 - x, 3);
}

/** The number to show `elapsed` ms into a count-up from 0 to `target`. */
export function countUpValue(
	target: number,
	elapsed: number,
	duration: number,
	decimals = 0
): number {
	if (duration <= 0 || elapsed >= duration) return target;
	const raw = target * easeCount(elapsed / duration);
	const factor = Math.pow(10, decimals);
	return Math.round(raw * factor) / factor;
}

export function formatStat(
	value: number,
	options: { locale?: string; decimals?: number; compact?: boolean } = {}
): string {
	const decimals = options.decimals ?? 0;
	return new Intl.NumberFormat(options.locale ?? 'en-US', {
		notation: options.compact ? 'compact' : 'standard',
		minimumFractionDigits: options.compact ? 0 : decimals,
		maximumFractionDigits: decimals
	}).format(value);
}
