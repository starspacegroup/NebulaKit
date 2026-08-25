/**
 * GET /auth.md — how agents authenticate against this deployment.
 *
 * Advertised as the `describedby` Link relation and from the API catalog.
 *
 * HONESTY RULE (AGENTS.md §8): this document says plainly that the site is an
 * OAuth *client* (it signs users in with GitHub/Discord), not an authorization
 * server, and that there is no automated agent-credential issuance. That is why
 * NebulaKit does NOT publish /.well-known/oauth-authorization-server or
 * /.well-known/oauth-protected-resource: those documents would advertise token
 * endpoints that do not exist, and an agent following them would fail in ways
 * that look like an outage.
 *
 * If you add a real OAuth authorization server or bearer-token API to your
 * site, publish those documents then — and update this file in the same change.
 */
import { site } from '$lib/site.config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const origin = url.origin;

	const body = `# Authentication — ${site.name}

_Machine-readable summary of how to authenticate with this site._

## Short version

**Most of what an agent wants needs no authentication at all.** All published
content is publicly readable, and every page can be fetched as Markdown:

\`\`\`sh
curl -H 'Accept: text/markdown' ${origin}/
\`\`\`

Start at [${origin}/sitemap.xml](${origin}/sitemap.xml), and see the skills
index at
[${origin}/.well-known/agent-skills/index.json](${origin}/.well-known/agent-skills/index.json).

## Agent registration

**Not offered.** This deployment does not issue API keys, client credentials, or
agent identities, and has no registration endpoint. There is no
\`/.well-known/oauth-authorization-server\` and no
\`/.well-known/oauth-protected-resource\` here — deliberately, because this site
is an OAuth *client*, not an authorization server. Publishing that metadata
would point you at token endpoints that do not exist.

Do not probe for them. If you need access beyond public content, ask the site
owner (see "Contact" below).

## How human sign-in works

Authenticated areas (the admin console, \`/profile\`, the CMS and chat APIs) are
protected by an **unsigned opaque session cookie**, established by a human logging
in. The browser holds only the raw opaque token; D1 stores its digest, expiry,
identity, and current roles so sessions can be revoked server-side.

| Property   | Value                                       |
| ---------- | ------------------------------------------- |
| Cookie     | \`session\`                                   |
| Path       | \`/\`                                         |
| Flags      | \`HttpOnly\`, \`SameSite=Lax\`, \`Secure\` on HTTPS |
| Lifetime   | 7 days                                      |

Sign-in routes:

- \`POST ${origin}/api/auth/login\` — \`{ "email", "password" }\`. Returns \`200\`
  with a \`Set-Cookie\`, \`400\` if fields are missing, \`401\` on bad credentials.
- \`POST ${origin}/api/auth/signup\` — create an account.
- \`GET ${origin}/api/auth/github\`, \`GET ${origin}/api/auth/discord\` — begin an
  OAuth sign-in **with that provider as the identity source**. These are not
  endpoints this site issues tokens from.
- \`POST ${origin}/api/auth/logout\` — clear the session.

Because the cookie is \`HttpOnly\` and set by a login the user performs, an agent
can only act on authenticated surfaces while operating **inside an already
signed-in browser session** (for example a browser-extension agent, or WebMCP
tools running on the page — see below). There is no headless credential flow.

## Bearer tokens

Not supported. No endpoint on this site accepts an \`Authorization: Bearer\`
header. Sending one has no effect.

## In-browser tools (WebMCP)

When a user visits this site with a WebMCP-capable agent, the page registers
tools via \`navigator.modelContext\` for searching, reading, and visible
same-origin navigation. Page reads are restricted to the public sitemap
allowlist and omit browser credentials, so an authenticated browser cannot use
WebMCP to expose private or admin content.

## Rate limits and etiquette

- Crawl rules and content-usage terms: [${origin}/robots.txt](${origin}/robots.txt)
- Prefer \`Accept: text/markdown\` over scraping HTML; it is cheaper for both of us.
- Prefer \`${origin}/sitemap.xml\` over crawling link-by-link.

## Contact

Reach the site owner through
[${origin}/contact](${origin}/contact), or programmatically via
\`POST ${origin}/api/contact-form-submissions\` (public; may require a Turnstile
token). See the \`send-a-contact-message\` skill for the full contract.
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
