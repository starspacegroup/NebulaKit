# SEO guide

Principles agreed during the davis9001.com work of 2026-10-24. They follow Google's published
spam policies and structured-data guidelines; they are not tricks.

## Pages

- **No doorway or scaled-content pages.** Do not generate a city x industry cross-product
  ("Plumbers in Phoenix", "Plumbers in Tucson", ...) with the same text and swapped nouns. Google
  treats that as spam and it can sink the whole site.
- **Each business-type or use-case page has distinct, genuine content**: the problems that type of
  reader actually has, examples that only fit them, answers to their questions. If you cannot write
  that, do not make the page.
- **A region page only when there is a real tie**: you work there, you have clients there, there is
  something local to say. No tie, no page.
- **Hub pages and internal links.** A hub lists its child pages; each child links back to the hub
  and to its nearest siblings. Every indexable page is reachable by links, not only by the sitemap.
- **Built in:** the who/where/what/when/why landing-page system and its audit enforce these rules.
  See [SEO_LANDING_PAGES.md](SEO_LANDING_PAGES.md).

## Every indexable page

- A unique `<title>`, meta description and `<h1>`. No two pages share any of the three.
- A `<link rel="canonical">` to its own clean URL (no query strings, one trailing-slash style).
- Listed in `sitemap.xml`; non-indexable pages carry `noindex` and are left out of it.
- Open Graph and Twitter tags with a real share image.

## Structured data

- JSON-LD only for content that is visible on the page.
- **FAQ JSON-LD must match the visible question and answer text exactly.** Render both from one data
  array so they cannot drift.
- Escape `<` in JSON-LD so a `</script>` in content cannot break out of the tag.
- Validate with Google's Rich Results Test after a change.

## Do not

- Do not use another company's logo or name to imply an endorsement (for example the Cloudflare logo
  because the site runs on Cloudflare).
- Do not claim certifications, awards or reviews you do not have.
- Do not hide text or links for crawlers only.

## What NebulaKit already gives you

- `src/lib/components/SharingMeta.svelte`: title, description, canonical, robots, Open Graph and
  Twitter tags. Use it on every page with page-specific props.
- `src/routes/sitemap.xml/+server.ts`: static routes from `SITEMAP_ROUTES`
  (`src/lib/agent-discovery.ts`) plus published CMS content. Add each new public page there or
  exclude it on purpose (AGENTS.md).
- `src/lib/components/FaqSection.svelte` + `src/lib/seo/faq.ts`: the visible FAQ and its FAQPage
  JSON-LD from one `FaqItem[]`. `jsonLdScriptTag()` escapes `<`, `>` and `&`.

```svelte
<script lang="ts">
	import FaqSection from '$lib/components/FaqSection.svelte';
	const faq = [{ question: 'Is the check free?', answer: 'Yes. It costs nothing.' }];
</script>

<FaqSection items={faq} />
```
