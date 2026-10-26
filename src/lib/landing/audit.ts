/**
 * The anti-doorway guardrails, as data a site's own test can assert on.
 *
 * `auditLanding(site)` returns `errors` (the site must not ship) and `todos`
 * (open `TODO(owner)` markers and draft stubs to finish). The shipped test
 * `tests/unit/landing-guardrails.test.ts` fails on any error and prints the
 * todos; `bun run landing report` prints both. The rules and their reasons
 * are in docs/SEO_LANDING_PAGES.md.
 */
import type { LandingLimits, LandingPage, LandingSiteConfig } from './types';

export const DEFAULT_LIMITS: LandingLimits = {
	titleMax: 70,
	descriptionMax: 170,
	minSections: 3,
	minFaq: 3
};

export interface AuditIssue {
	rule:
		| 'family'
		| 'required'
		| 'duplicate'
		| 'cross-product'
		| 'region-tie'
		| 'number'
		| 'length'
		| 'minimum'
		| 'example';
	/** `family/slug`, or `site` for site-wide problems. */
	page: string;
	message: string;
}

export interface AuditTodo {
	page: string;
	field: string;
	text: string;
}

export interface AuditReport {
	errors: AuditIssue[];
	todos: AuditTodo[];
}

const TODO = /TODO\(([^)]*)\)[:\s]*([^]*)/;

/**
 * Figures a reader might take as fact: percentages, money, multipliers, and
 * any number of two or more digits. A one-digit count ("three steps", "2
 * hours") reads as ordinary prose and is not flagged.
 */
const NUM = String.raw`\d+(?:[.,]\d+)*`;
const FIGURE = new RegExp(
	[
		String.raw`\$\s?${NUM}`,
		String.raw`${NUM}\s?(?:%|percent\b|x\b|times\b)`,
		String.raw`\b\d{2,}(?:[.,]\d+)*(?:\s?[kKmM]\b)?`,
		String.raw`\b\d(?:[.,]\d+)+`
	].join('|'),
	'g'
);

/** Every string field of a page, with a readable path. */
function strings(page: LandingPage): { field: string; text: string }[] {
	const out: { field: string; text: string }[] = [];
	const walk = (value: unknown, path: string) => {
		if (typeof value === 'string') out.push({ field: path, text: value });
		else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
		else if (value && typeof value === 'object')
			for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
	};
	const {
		verifiedNumbers: _verified,
		family: _family,
		slug: _slug,
		notes: _notes,
		tie,
		...prose
	} = page;
	walk(prose, '');
	if (tie) walk({ tie: { note: tie.note } }, '');
	return out;
}

const REQUIRED = [
	'name',
	'title',
	'description',
	'h1',
	'lede',
	'blurb',
	'sectionsHeading'
] as const;

const id = (p: LandingPage) => `${p.family}/${p.slug}`;
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function auditLanding(site: LandingSiteConfig): AuditReport {
	const limits = { ...DEFAULT_LIMITS, ...site.limits };
	const errors: AuditIssue[] = [];
	const todos: AuditTodo[] = [];
	const err = (rule: AuditIssue['rule'], page: string, message: string) =>
		errors.push({ rule, page, message });

	const prefixes = site.families.flatMap((f) => [f.prefix, ...(f.legacyPrefixes ?? [])]);
	for (const p of new Set(prefixes)) {
		if (prefixes.filter((x) => x === p).length > 1)
			err('family', 'site', `URL prefix "${p}" is used by more than one family`);
	}

	for (const page of site.pages) {
		for (const { field, text } of strings(page)) {
			const m = TODO.exec(text);
			if (m) todos.push({ page: id(page), field, text: m[2].trim() || `(owner: ${m[1]})` });
		}
		for (const [i, note] of (page.notes ?? []).entries()) {
			const m = TODO.exec(note);
			if (m) todos.push({ page: id(page), field: `notes[${i}]`, text: m[2].trim() });
		}
		if (page.draft) todos.push({ page: id(page), field: 'draft', text: 'stub not yet published' });
		if (!site.families.some((f) => f.key === page.family))
			err('family', id(page), `family "${page.family}" is not configured for this site`);
	}

	const live = site.pages.filter((p) => !p.draft);

	for (const page of live) {
		const where = id(page);
		for (const f of REQUIRED) if (!page[f].trim()) err('required', where, `${f} is empty`);
		for (const { field, text } of strings(page)) {
			if (TODO.test(text)) err('required', where, `${field} still has a TODO marker`);
		}
		if (page.title.length > limits.titleMax)
			err('length', where, `title is ${page.title.length} chars (max ${limits.titleMax})`);
		if (page.description.length > limits.descriptionMax)
			err(
				'length',
				where,
				`description is ${page.description.length} chars (max ${limits.descriptionMax})`
			);
		if (page.sections.length < limits.minSections)
			err('minimum', where, `${page.sections.length} sections (min ${limits.minSections})`);
		if (page.faq.length < limits.minFaq)
			err('minimum', where, `${page.faq.length} FAQ items (min ${limits.minFaq})`);
	}

	const unique = (label: string, pick: (p: LandingPage) => string[]) => {
		const seen = new Map<string, string>();
		for (const page of live) {
			for (const value of pick(page)) {
				const key = normalize(value);
				if (!key) continue;
				const first = seen.get(key);
				if (first && first !== id(page)) err('duplicate', id(page), `${label} repeats ${first}`);
				else if (first) err('duplicate', id(page), `${label} repeats within the page`);
				else seen.set(key, id(page));
			}
		}
	};
	unique('slug', (p) => [`${p.family}/${p.slug}`]);
	unique('title', (p) => [p.title]);
	unique('h1', (p) => [p.h1]);
	unique('lede', (p) => [p.lede]);
	unique('description', (p) => [p.description]);
	unique('section body', (p) => [
		...p.sections.map((s) => s.body),
		...(p.extra?.sections.map((s) => s.body) ?? [])
	]);
	unique('FAQ answer', (p) => p.faq.map((f) => f.answer));

	const regionFamilies = new Set(site.families.filter((f) => f.region).map((f) => f.key));
	const regions = live.filter((p) => regionFamilies.has(p.family));
	for (const region of regions) {
		if (!region.tie?.note.trim())
			err('region-tie', id(region), 'region page has no declared tie to the place');
	}
	for (const page of live.filter((p) => !regionFamilies.has(p.family))) {
		for (const region of regions) {
			const named =
				page.slug.includes(region.slug) ||
				normalize(`${page.title} ${page.h1}`).includes(normalize(region.name));
			if (named)
				err(
					'cross-product',
					id(page),
					`names the region "${region.name}"; put place content on ${id(region)} instead`
				);
		}
	}

	const allowed = [...(site.verifiedNumbers ?? [])];
	for (const page of live) {
		const verified = [...allowed, ...(page.verifiedNumbers ?? [])];
		for (const { field, text } of strings(page)) {
			const cleared = verified.reduce((t, phrase) => t.split(phrase).join(' '), text);
			for (const m of cleared.matchAll(FIGURE))
				err(
					'number',
					id(page),
					`${field}: "${m[0].trim()}" is unverified; add the phrase to verifiedNumbers once checked`
				);
		}
	}

	if (!site.example) {
		for (const page of live) {
			if (strings(page).some(({ text }) => /Example Co\./.test(text)))
				err('example', id(page), 'still contains the shipped Example Co. content');
		}
	}

	return { errors, todos };
}

/** Plain-text report for the terminal. */
export function formatAudit(report: AuditReport): string {
	const lines = [`Landing audit: ${report.errors.length} error(s), ${report.todos.length} TODO(s)`];
	for (const e of report.errors) lines.push(`  ERROR [${e.rule}] ${e.page}: ${e.message}`);
	for (const t of report.todos) lines.push(`  TODO  ${t.page} ${t.field}: ${t.text}`);
	return lines.join('\n');
}
