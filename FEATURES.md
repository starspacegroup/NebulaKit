# NebulaKit feature map

This document maps what the starter template ships to where it is implemented. Everything below is
working code in this repository, inherited by any app created from it with "Use this template"; it
is not a catalog of hypothetical integrations.

## Content platform

- Typed content definitions and field registry: `src/lib/cms/registry.ts`
- CMS services and D1 persistence: `src/lib/services/cms.ts`
- Rich-text authoring and embeds: `src/lib/components/RichTextEditor.svelte`
- Public type and entry routes: `src/routes/[contentType]/`
- Protected CMS administration: `src/routes/admin/cms/`
- R2-backed media upload and retrieval: `src/routes/api/admin/upload/` and
  `src/routes/media/[...key]/`

Embeds are allowlisted through the manifest in `src/lib/cms/embeds/manifest.ts`; unknown embed
types are not dynamically imported. See [docs/CMS_EMBEDS.md](./docs/CMS_EMBEDS.md).

## Authentication and accounts

NebulaKit implements its authentication boundary in the application rather than delegating it to
Auth.js.

- Password signup and login with password hashing
- GitHub OAuth client routes
- Discord OAuth client routes
- Signed session cookies
- Account connection and merge flows
- Owner bootstrap and setup lock
- Admin and statistics permissions
- Profile identity and connected-account management

The canonical implementation is under `src/routes/api/auth/`, `src/lib/utils/session.ts`,
`src/lib/utils/passwords.ts`, and `src/lib/services/account-merge.ts`.

NebulaKit is an OAuth **client**. It does not expose an OAuth authorization server or protected
resource metadata.

## AI chat and voice

- Provider credentials are stored through the protected AI-key administration routes.
- Chat requests stream through `src/routes/api/chat/stream/+server.ts`.
- Conversation history is synchronized through `src/lib/stores/chatHistory.ts`.
- Available models are exposed through `src/routes/api/chat/models/+server.ts`.
- Realtime voice sessions are optional and require a compatible configured provider.

No AI response is fabricated when a provider is unavailable. The UI reports missing setup and the
server returns an explicit error.

## Administration

The `/admin` surface includes:

- User search and permission management
- Authentication-provider credentials
- AI-provider credentials and model discovery
- CMS types and entries
- Contact-form submissions
- Setup/reset controls
- First-party analytics

Sensitive values are masked by default. PII reveal is a separate protected request path with
permission checks; see `src/routes/api/admin/pii-reveal/+server.ts`.

## First-party analytics

NebulaKit stores bounded aggregate counters in D1:

- Page and route views
- Referrer and country buckets
- Coarse operating-system, browser, device, language, and viewport buckets
- User and content growth
- Cloudflare request-plan projections

The implementation does not store raw IP addresses or raw User-Agent strings and does not require a
third-party analytics script. Operators need `can_view_stats`. See
[docs/ADMIN_STATS.md](./docs/ADMIN_STATS.md).

## Agent-ready publishing

| Surface                                      | Purpose                                                 |
| -------------------------------------------- | ------------------------------------------------------- |
| `/robots.txt`                                | Crawl policy and Cloudflare Content Signals             |
| `/sitemap.xml`                               | Static routes plus published CMS content                |
| `/.well-known/api-catalog`                   | RFC 9727 API catalog                                    |
| `/.well-known/agent-skills/index.json`       | Agent Skills discovery index                            |
| `/.well-known/agent-skills/{skill}/SKILL.md` | Rendered skill documentation                            |
| `/auth.md`                                   | Accurate authentication guidance for agents             |
| `Accept: text/markdown`                      | Markdown representation of public pages                 |
| WebMCP tools                                 | Same-origin search, read, navigation, and theme actions |

The discovery contract intentionally omits services NebulaKit does not implement. Route coverage is
enforced by `tests/unit/agent-readiness.test.ts`. See
[docs/AGENT_READINESS.md](./docs/AGENT_READINESS.md).

## Cloudflare runtime

Configured bindings:

- `DB`: D1 database
- `KV`: runtime configuration and secret-backed application state
- `BUCKET`: R2 media storage

Queue configuration is intentionally disabled in `wrangler.toml`; NebulaKit does not claim an active
queue consumer or producer. Turnstile verification is available when the required secret is
configured.

The build guard rejects placeholder, quarantined, or aliased resource identifiers before a remote
build/deploy. See [docs/CLOUDFLARE_SETUP.md](./docs/CLOUDFLARE_SETUP.md).

## Interface and accessibility

- Responsive navigation and application shell
- Command palette with keyboard navigation
- Light, dark, and system theme preferences
- CSS-variable design tokens
- Automated WCAG AA contrast validation
- Complete PWA manifest and install icons
- Open Graph, Twitter, canonical, and article metadata
- Pointer, touch, and keyboard dragging built on Pointer Events, with a live-region
  announcement for every move
- A columned widget board over a registry-driven widget catalogue, and a pure
  `reorder()` engine usable on its own

See [docs/THEME_SYSTEM.md](./docs/THEME_SYSTEM.md),
[docs/COMMAND_PALETTE.md](./docs/COMMAND_PALETTE.md), and
[docs/WIDGET_BOARD.md](./docs/WIDGET_BOARD.md).

## Quality contract

- Svelte/TypeScript check with zero errors
- Vitest unit and integration suites
- A hard 95% floor for lines, statements, functions, and branches
- Playwright end-to-end coverage for the core user journey
- Theme contrast validation
- Immutable migration policy

Commands and contribution rules are documented in [CONTRIBUTING.md](./CONTRIBUTING.md) and
[docs/TDD_WORKFLOW.md](./docs/TDD_WORKFLOW.md).
