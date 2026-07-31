/**
 * Agent Skills published by this site (Agent Skills Discovery RFC v0.2.0).
 *
 * A "skill" is a short Markdown document telling an agent how to do one thing
 * with this site, discoverable from /.well-known/agent-skills/index.json and
 * fetched from /.well-known/agent-skills/<name>/SKILL.md.
 *
 * HONESTY RULE (AGENTS.md §8): every skill here describes behaviour this
 * codebase actually implements — the endpoints, status codes, and validation
 * rules below are mirrored from the real handlers. A skill that documents a
 * capability the site lacks sends agents into failure loops. When you change an
 * endpoint the skill covers, update the skill in the same change.
 *
 * Bodies are rendered per-request with the live origin so the examples are
 * copy-pasteable on localhost, preview deploys, and production alike. The index
 * digests exactly the bytes this module renders, so the two can never drift.
 */
import { site } from '$lib/site.config';
import { CONTENT_SIGNAL } from '$lib/agent-discovery';

/** A skill document, rendered on demand for a given origin. */
export interface AgentSkillDefinition {
	/** Identifier: lowercase alphanumeric plus hyphens (RFC v0.2.0). */
	name: string;
	/** One-line summary shown in the discovery index. */
	description: string;
	/** Render the full SKILL.md body for this origin. */
	render: (origin: string) => string;
}

/** YAML frontmatter block that opens every SKILL.md. */
function frontmatter(name: string, description: string): string {
	return ['---', `name: ${name}`, `description: ${description}`, '---', ''].join('\n');
}

const READ_AS_MARKDOWN: AgentSkillDefinition = {
	name: 'read-pages-as-markdown',
	description: `Fetch any public page on ${site.name} as Markdown instead of HTML.`,
	render: (origin) =>
		frontmatter(
			'read-pages-as-markdown',
			`Fetch any public page on ${site.name} as Markdown instead of HTML.`
		) +
		`# Read pages as Markdown

Every public HTML page on this site can be served as Markdown. Ask for it with
an \`Accept\` header — no separate URL, no API key.

\`\`\`sh
curl -H 'Accept: text/markdown' ${origin}/
\`\`\`

## What you get back

- \`Content-Type: text/markdown; charset=utf-8\`
- \`x-markdown-tokens\` — an approximate token count for the body, so you can
  budget context before you read it.
- \`Vary: Accept\` — caches keep the HTML and Markdown representations apart.

Site chrome (navigation, footer, scripts, styles) is stripped; you get the
page's main content converted to Markdown, with links and headings preserved.

## Rules

- HTML stays the default. A request without \`Accept: text/markdown\` gets the
  normal page, unchanged.
- Only successful HTML pages convert. JSON endpoints, images, \`/sitemap.xml\`
  and \`/robots.txt\` are returned as-is.
- Combine this with any other skill — every page URL below supports it.
`
};

const BROWSE_CONTENT: AgentSkillDefinition = {
	name: 'browse-published-content',
	description: `Discover and read published articles and pages on ${site.name}.`,
	render: (origin) =>
		frontmatter(
			'browse-published-content',
			`Discover and read published articles and pages on ${site.name}.`
		) +
		`# Browse published content

## 1. Enumerate everything

\`${origin}/sitemap.xml\` lists every crawlable URL on this site, including one
entry per published content item with a \`lastmod\` date. Start there rather
than guessing paths.

## 2. Understand the URL shape

Content is grouped into *content types* (blog, faq, and any type the site owner
has added). Two URL patterns exist:

- \`${origin}/{contentType}\` — a paginated list page
- \`${origin}/{contentType}/{slug}\` — one item

## 3. Filter list pages

List pages accept query parameters:

| Parameter | Effect                                  |
| --------- | --------------------------------------- |
| \`search\`  | Match against item title and slug        |
| \`tag\`     | Restrict to one tag slug                 |
| \`page\`    | 1-based page number                      |

\`\`\`sh
curl -H 'Accept: text/markdown' '${origin}/blog?search=cloudflare&page=2'
\`\`\`

## Notes

- Only items with status \`published\` are ever served here. Drafts and archived
  items are not publicly reachable, by any URL.
- The JSON CMS API under \`/api/cms\` requires an authenticated session and is
  not available to anonymous agents — read content through these page URLs
  instead (see \`read-pages-as-markdown\`).
- Usage terms for anything you read here are declared in
  \`${origin}/robots.txt\` as \`Content-Signal: ${CONTENT_SIGNAL}\`.
`
};

const CONTACT: AgentSkillDefinition = {
	name: 'send-a-contact-message',
	description: `Submit a message to the ${site.name} site owner via the public contact API.`,
	render: (origin) =>
		frontmatter(
			'send-a-contact-message',
			`Submit a message to the ${site.name} site owner via the public contact API.`
		) +
		`# Send a contact message

Public endpoint — no session or API key required.

\`\`\`http
POST ${origin}/api/contact-form-submissions
Content-Type: application/json

{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "message": "A message of at least eight characters."
}
\`\`\`

## Validation

All three fields are required. Values are trimmed before checking.

- \`email\` must contain an \`@\` and a dotted domain.
- \`message\` must be at least 8 characters after trimming.

## Responses

| Status | Meaning                                                       |
| ------ | ------------------------------------------------------------- |
| \`201\`  | Stored. Body is \`{ "submission": { ... } }\`.                   |
| \`400\`  | Validation failed, or the bot check was rejected.              |
| \`500\`  | The site's database binding is unavailable.                    |

## Bot protection

If the deployment has Cloudflare Turnstile configured, the request must also
carry a solved token:

\`\`\`json
{ "cf-turnstile-response": "<token>" }
\`\`\`

Automated agents generally cannot produce a Turnstile token. If you receive
\`400 Verification failed\`, hand the task to a human with the HTML form at
\`${origin}/contact\` rather than retrying — retries will not succeed.

## Courtesy

This delivers a real message to a real person's inbox. Send one, on behalf of a
user who asked you to, with a genuine return address.
`
};

/** Every skill this site publishes, in index order. */
export const AGENT_SKILLS: readonly AgentSkillDefinition[] = [
	READ_AS_MARKDOWN,
	BROWSE_CONTENT,
	CONTACT
];

/** Look up a skill by its `name`, or undefined when there is no such skill. */
export function findAgentSkill(name: string): AgentSkillDefinition | undefined {
	return AGENT_SKILLS.find((skill) => skill.name === name);
}

/**
 * SHA-256 of `text` as the RFC's `sha256:<hex>` digest string.
 *
 * Uses Web Crypto, which is present in Workers and in Node 18+, so the same
 * code runs on the edge and under vitest. Computed from the rendered bytes at
 * request time rather than checked in, so the digest cannot go stale when a
 * skill's wording changes.
 */
export async function skillDigest(text: string): Promise<string> {
	const bytes = new TextEncoder().encode(text);
	const hash = await crypto.subtle.digest('SHA-256', bytes);
	const hex = Array.from(new Uint8Array(hash))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
	return `sha256:${hex}`;
}
