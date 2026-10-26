/**
 * Landing pages: hand-written pages that answer one kind of search each —
 * who the site serves, where, what it does, when to call, why choose it.
 *
 * Every page is written by a person. Nothing in this module generates prose:
 * pages that swap one noun in shared template text are what Google's spam
 * policies call doorway pages and scaled content abuse. The audit in
 * `audit.ts` fails a site whose pages repeat each other. See
 * docs/SEO_LANDING_PAGES.md.
 *
 * This module stays dependency-free (no `$app`, no Node APIs) because
 * `agent-discovery.ts` reads the landing paths for the sitemap.
 */
import type { FaqItem } from '$lib/seo/faq';

export type { FaqItem };

/** The five families. A site may use any subset. */
export type FamilyKey = 'who' | 'where' | 'what' | 'when' | 'why';

export interface LandingFamily {
	key: FamilyKey;
	/** URL segment, no slashes: `who` serves `/who` and `/who/<slug>`. */
	prefix: string;
	/** Hub name for breadcrumbs and links, e.g. "Who we work with". */
	label: string;
	/** Hub `<title>`. */
	hubTitle: string;
	/** Hub meta description. */
	hubDescription: string;
	hubH1: string;
	hubIntro: string;
	/**
	 * Region family. Its pages must declare a real tie to the place, and no
	 * page in another family may name one of its places (no type × region
	 * cross-product).
	 */
	region?: boolean;
	/** Old URL segments that now 301 to `prefix` (a renamed family). */
	legacyPrefixes?: string[];
}

export interface LandingSection {
	heading: string;
	body: string;
}

/** Why a region page exists. Without one, a place page is a doorway page. */
export interface RegionTie {
	kind: 'based-here' | 'office' | 'worked-here' | 'family' | 'other';
	/** One literal, checkable sentence: "Our only office is on Example Street." */
	note: string;
}

export interface LandingPage {
	family: FamilyKey;
	slug: string;
	/** Short name for hub cards and breadcrumbs. */
	name: string;
	/** `<title>` text; SharingMeta adds the site name. */
	title: string;
	/** Meta description. */
	description: string;
	h1: string;
	lede: string;
	/** One sentence for the hub card. */
	blurb: string;
	/** Heading over `sections`, e.g. "What a restaurant site needs". */
	sectionsHeading: string;
	sections: LandingSection[];
	/** Optional second block, e.g. local facts on a region page. */
	extra?: { heading: string; sections: LandingSection[] };
	/** Optional checklist: things the reader can verify or the product checks. */
	checks?: { heading: string; items: string[] };
	/** Visible FAQ and the FAQPage JSON-LD, from this one array. */
	faq: FaqItem[];
	/** Extra internal links beyond the family siblings. */
	related?: { href: string; label: string }[];
	/** schema.org `serviceType` for the Service JSON-LD. */
	serviceType?: string;
	/** schema.org `areaServed`. */
	areaServed?: string | string[];
	/** Required on region pages. */
	tie?: RegionTie;
	/**
	 * Exact phrases containing numbers that the owner has checked against a
	 * source, e.g. "WCAG 2.2". The audit flags every other figure.
	 */
	verifiedNumbers?: string[];
	/**
	 * Owner notes, never rendered. Put `TODO(owner): confirm …` here for a
	 * claim on a live page that still needs checking; the audit reports these
	 * without failing. A TODO inside rendered text fails the audit instead,
	 * because it would show on the page.
	 */
	notes?: string[];
	/**
	 * A stub still being written. Not routed, not in the sitemap, and the
	 * audit lists its TODOs instead of failing on its empty fields.
	 */
	draft?: boolean;
}

export interface LandingLimits {
	titleMax: number;
	descriptionMax: number;
	minSections: number;
	minFaq: number;
}

export interface LandingSiteConfig {
	/**
	 * True while the shipped Example Co. pages are in place: pages render an
	 * "example content" notice, carry `noindex`, and stay out of the sitemap.
	 */
	example: boolean;
	/** Production origin, no trailing slash. Canonical and JSON-LD URLs use it. */
	origin: string;
	provider: { name: string; url: string };
	/** Calls to action on every page and hub. */
	cta: { primary: { href: string; label: string }; secondary?: { href: string; label: string } };
	/** Root-relative share image for OG cards. */
	ogImage?: { src: string; alt: string; width: number; height: number };
	families: LandingFamily[];
	pages: LandingPage[];
	/** Number phrases verified site-wide, e.g. a founding year. */
	verifiedNumbers?: string[];
	limits?: Partial<LandingLimits>;
	/**
	 * A street address that is already public on the site. Only then may the
	 * JSON-LD carry a postal address; otherwise there is no LocalBusiness.
	 */
	publicAddress?: {
		streetAddress: string;
		addressLocality: string;
		addressRegion: string;
		postalCode: string;
		addressCountry: string;
	};
}
