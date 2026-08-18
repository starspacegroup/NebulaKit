# Agent Readiness

How this site makes itself discoverable and usable by AI agents and crawlers.

The rules that keep it working live in [AGENTS.md §8](../AGENTS.md); this document
is the detail — what each surface is, why it is built the way it is, what still
needs doing by hand, and how to verify it.

---

## Why routes, not files in `static/`

Every surface below is a SvelteKit endpoint rather than a static file for two
operational reasons:

1. **Self-correcting URLs.** robots.txt, the sitemap, and the catalogs build
   absolute URLs from the _live request origin_. The sitemap protocol requires
   every entry to share the sitemap's host, so this is also the more correct
   reading of the spec. Practical effect: the files are right on `localhost`, on
   a `*.pages.dev` preview, and on a custom domain, without per-domain URL edits.
2. **One source controls policy.** A generated route keeps the live origin and
   policy constants together instead of duplicating deploy-specific URLs in a
   static `robots.txt`.

Policy and route data live in one module — [`src/lib/agent-discovery.ts`](../src/lib/agent-discovery.ts) —
so the routes, the hooks, and the tests can never disagree.

---

## What is published

| URL                                         | Standard                                                                                             | Source                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `/robots.txt`                               | RFC 9309 + [Content Signals](https://contentsignals.org)                                             | `src/routes/robots.txt/`                                     |
| `/sitemap.xml`                              | [sitemaps.org](https://www.sitemaps.org/protocol.html)                                               | `src/routes/sitemap.xml/`                                    |
| `/.well-known/api-catalog`                  | RFC 9727 / RFC 9264                                                                                  | `src/routes/[x+2e]well-known/api-catalog/`                   |
| `/.well-known/agent-skills/index.json`      | Agent Skills Discovery v0.2.0                                                                        | `src/routes/[x+2e]well-known/agent-skills/index.json/`       |
| `/.well-known/agent-skills/<name>/SKILL.md` | —                                                                                                    | `src/routes/[x+2e]well-known/agent-skills/[skill]/SKILL.md/` |
| `/auth.md`                                  | [auth.md](https://github.com/workos/auth.md)                                                         | `src/routes/auth.md/`                                        |
| `/api/health`                               | —                                                                                                    | `src/routes/api/health/`                                     |
| `Link:` headers on HTML                     | RFC 8288                                                                                             | `src/hooks.server.ts`                                        |
| `Accept: text/markdown`                     | [Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/) | `src/hooks.server.ts`                                        |
| WebMCP tools                                | [WebMCP](https://webmachinelearning.github.io/webmcp/)                                               | `src/lib/webmcp.ts`                                          |

### robots.txt

One wildcard group plus one group naming ~23 AI crawlers explicitly. Naming them
matters even when the policy is identical: some operators only honour rules
written against their own token, and auditors flag a robots.txt with no
AI-specific entries.

Private surfaces (`/admin/`, `/api/`, `/auth/`, `/profile`, `/reset`, `/setup`,
`/media/`) are disallowed for **every** group. `/api/health` is re-allowed above
`/api/` — RFC 9309 resolves conflicts by longest match — so the API catalog's
`status` link stays reachable.

> **Content Signals default is fully permissive:** `search=yes, ai-input=yes,
ai-train=yes`. That matches NebulaKit's public open-source content. **Before
> publishing proprietary content, change
> `CONTENT_SIGNAL` in `src/lib/agent-discovery.ts` before launch.** Setting
> `ai-train=no` is a one-word edit that every robots.txt group picks up.

### sitemap.xml

Static pages come from `SITEMAP_ROUTES`; CMS content is read from D1 per request,
so publishing a post updates the sitemap with no build step or cron job. Only
`status = 'published'` items appear.

If D1 is unreachable, the static routes are still served. A partial sitemap is
useful; a 500 tells the crawler the site has no sitemap at all.

`lastmod` is emitted at **date** granularity: D1 writes `CURRENT_TIMESTAMP` as
`YYYY-MM-DD HH:MM:SS`, which is not valid W3C datetime, and inventing a timezone
would be worse than omitting the time.

### Markdown for agents

Any request carrying `Accept: text/markdown` gets a Markdown rendering of the
page; everything else gets HTML, unchanged. Responses set
`Content-Type: text/markdown`, an approximate `x-markdown-tokens` count, and
`Vary: Accept` — the last one is not optional, or a shared cache will hand
Markdown to a browser.

Conversion is in-house ([`src/lib/server/html-to-markdown.ts`](../src/lib/server/html-to-markdown.ts))
per the minimal-dependency rule. It scopes to `<main>`, which is how site chrome
is excluded — the layout puts navigation and the footer outside it. A conversion
failure falls back to HTML rather than costing the caller the page.

### Agent skills

Three skills, each describing something the site genuinely does: reading pages as
Markdown, browsing published content, and submitting the contact form. `digest`
values are SHA-256 of the exact bytes the SKILL.md route renders for that origin,
computed per request — so a skill edit can never leave a stale digest behind.

### WebMCP

Registers read-and-navigate tools via `navigator.modelContext` when the browser
supports it, and does nothing when it doesn't (which is most browsers today).

Every tool is safe to call without confirmation. Path inputs are resolved against
the site's own origin and rejected if they escape it. Content reads must also be
present in the public sitemap, and both sitemap/page fetches omit browser
credentials, so a signed-in visitor cannot expose private content through the
tool. **If you add a tool with side effects, require explicit user confirmation
first**; agents call these speculatively.

---

## What is deliberately NOT published

Publishing discovery metadata for a service you don't run is worse than
publishing nothing: a conforming agent follows it and fails in ways that look
like your site is broken.

| Not published                             | Why                                                                                                                                             | Publish it when…                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `/.well-known/oauth-authorization-server` | This app is an OAuth **client** (it signs users in with GitHub/Discord). It issues no tokens and has no authorization, token, or JWKS endpoint. | You actually run an authorization server. |
| `/.well-known/oauth-protected-resource`   | Its APIs are protected by an `HttpOnly` session cookie, not bearer tokens. No endpoint accepts `Authorization: Bearer`.                         | You add bearer-token API auth.            |
| `/.well-known/mcp/server-card.json`       | There is no MCP server.                                                                                                                         | You ship a real MCP endpoint.             |

`/auth.md` states all of this in plain language, so an agent learns _why_ those
files are absent instead of probing for them.

---

## Still to do by hand: DNS-AID records

DNS records live in your DNS provider, not this repo, so NebulaKit cannot publish
them from the application.

[DNS for AI Discovery](https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/)
advertises agent entry points as SVCB records ([RFC 9460](https://www.rfc-editor.org/rfc/rfc9460))
under an `_agents` label. In the Cloudflare dashboard: **DNS → Records → Add
record → SVCB**.

Replace `example.com` with your domain:

```dns
; Primary discovery entry point — points agents at this site.
_index._agents.example.com. 3600 IN SVCB 1 example.com. alpn="h2" port=443

; Optional: advertise an Agent2Agent endpoint, if you run one.
_a2a._agents.example.com.   3600 IN SVCB 1 agent.example.com. alpn="a2a" port=443
```

Notes:

- **Use ServiceMode** (priority `1` or higher), not AliasMode (`0`) — SvcParams
  are only meaningful in ServiceMode.
- Only publish `_a2a` if an A2A endpoint really exists. The honesty rule applies
  to DNS too.
- Parameters not yet IANA-registered use the numeric `keyNNNNN` form.
- **Sign the zone with DNSSEC**, or validating resolvers can't authenticate the
  answer. Cloudflare: **DNS → Settings → DNSSEC → Enable**, then add the DS
  record it shows you at your registrar.

Verify once propagated:

```sh
dig +short _index._agents.example.com SVCB
dig +dnssec _index._agents.example.com SVCB | grep -q 'ad;' && echo "DNSSEC OK"
```

---

## Verifying

Discovery URLs derive from the request origin without per-domain URL edits, but
service readiness still depends on real Cloudflare bindings. With the committed
`REPLACE_ME_*` ids, `/api/health` correctly returns `503`/`degraded`; production
builds and remote migration/deploy commands fail until `bun run setup:cf` writes
project-owned ids.

Unit tests cover the whole surface, including a guard that fails when a new
public page is added without a sitemap decision:

```sh
bun run test -- agent-readiness html-to-markdown markdown-negotiation webmcp
```

Against a running site (`bun run dev`, or a deployed URL):

```sh
BASE=http://localhost:4277

curl -s $BASE/robots.txt | head -20
curl -s $BASE/sitemap.xml | head -20
curl -s $BASE/.well-known/api-catalog | head -20
curl -s $BASE/.well-known/agent-skills/index.json

# Link headers and markdown negotiation
curl -sI $BASE/ | grep -i '^link:'
curl -s -H 'Accept: text/markdown' $BASE/ | head -20
curl -sI -H 'Accept: text/markdown' $BASE/ | grep -iE 'content-type|x-markdown-tokens|vary'

# A published digest must match the bytes served
curl -s $BASE/.well-known/agent-skills/read-pages-as-markdown/SKILL.md | sha256sum
```

Third-party audit: <https://isitagentready.com>.

---

## Adding a new public page

1. Build the route as usual.
2. Add its path to `SITEMAP_ROUTES` in [`src/lib/agent-discovery.ts`](../src/lib/agent-discovery.ts) —
   or to `SITEMAP_EXCLUDED_ROUTES` with a reason, if it shouldn't be indexed.
3. Run the tests. Skipping step 2 fails `tests/unit/agent-readiness.test.ts` with
   a message naming the route. That failure is the feature.
