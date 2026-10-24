/**
 * FAQ structured data built from the same array the page renders.
 *
 * Google requires FAQPage markup to match the visible question and answer
 * text. Keeping one `FaqItem[]` and deriving both the HTML and the JSON-LD
 * from it means the two cannot drift. See docs/SEO_GUIDE.md.
 */
export interface FaqItem {
	question: string;
	/** Plain text. Rendered as text on the page and copied verbatim into JSON-LD. */
	answer: string;
}

export interface FaqPageJsonLd {
	'@context': 'https://schema.org';
	'@type': 'FAQPage';
	mainEntity: {
		'@type': 'Question';
		name: string;
		acceptedAnswer: { '@type': 'Answer'; text: string };
	}[];
}

/** Build a schema.org FAQPage object. Items with an empty question or answer are dropped. */
export function faqJsonLd(items: FaqItem[]): FaqPageJsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: items
			.filter((i) => i.question.trim() && i.answer.trim())
			.map((i) => ({
				'@type': 'Question',
				name: i.question,
				acceptedAnswer: { '@type': 'Answer', text: i.answer }
			}))
	};
}

/**
 * Serialize JSON-LD for a `<script type="application/ld+json">` body.
 * `<`, `>` and `&` are escaped so text such as `</script>` cannot close the tag.
 */
export function serializeJsonLd(data: unknown): string {
	return JSON.stringify(data)
		.replace(/</g, '\\u003c')
		.replace(/>/g, '\\u003e')
		.replace(/&/g, '\\u0026');
}

/** A complete script tag, ready for `{@html}` inside `<svelte:head>`. */
export function jsonLdScriptTag(data: unknown): string {
	return `<script type="application/ld+json">${serializeJsonLd(data)}</` + `script>`;
}
