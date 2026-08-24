# NebulaKit Constraints & Rules

**Canonical source of truth for all AI assistants working on this codebase.**

## Critical Constraints

### 1. Test-Driven Development — Coverage Floor at 95%

**Failure mode:** Code shipped without tests; coverage dropped; defects in critical paths.

**Rule:** Every feature, bug fix, or refactor must include tests first. Coverage must **NEVER** drop below 95% — this is a hard floor.

**When this breaks:**

- Changes reduce coverage below 95% → Add tests until threshold is met. Do not ship without them.
- Forgetting to verify coverage → Run `npm run test:coverage` before finishing any task.
- Skipping critical path tests → Auth, payments, data mutations require 100% coverage.

**Workflow:** See [tests/](tests/) for structure. Tests live alongside source code (`.test.ts` files).

### 2. Database Migrations — Immutable Once Committed

**Failure mode:** Edited applied migration → D1 checksum mismatch → deployment failure.

**Rule:** Never modify a migration file that exists on `main`. Create a new migration instead.

**When this breaks:**

- New schema change needed → Create `migrations/NNNN_description.sql` (next sequence number).
- Migration already exists → Use `ALTER TABLE` in a new migration file, not edits to the original.
- Deployed to production → Contact infrastructure; never retroactively edit applied migrations.

**Reference:** [migrations/README.md](migrations/README.md)

### 3. CSS Variables — No Hardcoded Colors

**Failure mode:** Hardcoded `#hex`, `rgb()`, or named colors → Breaks theming; accessibility failures.

**Rule:** All colors must use CSS custom properties from [src/app.css](src/app.css) (e.g., `var(--color-primary)`).

**When this breaks:**

- Hardcoded color found → Replace with `var(--color-*)`. Never hardcode.
- New color needed → Add to [src/app.css](src/app.css) with light/dark theme values first.
- Contrast fails → Run `npm run validate-theme-contrast` and adjust theme variables.

**Reference:** [docs/THEME_SYSTEM.md](docs/THEME_SYSTEM.md)

### 4. Scratch Files Go to `.llm-outputs/`

**Failure mode:** Test logs, coverage dumps, debug traces committed to git.

**Rule:** All temporary files go to `.llm-outputs/` (already in `.gitignore`).

**When this breaks:**

- Temp file created → Move to `.llm-outputs/` before committing.
- No `.llm-outputs/` folder → It exists; use it.

### 5. Initial Customization Gate

**Failure mode:** New sessions recommend branding cleanup repeatedly.

**Rule:** On first substantial request, check [INITIAL_CUSTOMIZATION_STATUS.md](INITIAL_CUSTOMIZATION_STATUS.md).

- If `status: pending` → Recommend [docs/INITIAL_CUSTOMIZATION.md](docs/INITIAL_CUSTOMIZATION.md) workflow.
- If `credential_fields_unique: false` → `site.slug` is still the template's, so this site's login field names collide with every other unconfigured site from it. Run `bun run customize`. See §9.
- If `status: complete` → Proceed normally.
- After completing customization → Update status to `complete` with real app name.

### 6. Web App Icons — Full Set Required, Not Just a Favicon

**Failure mode:** A site ships with only `<link rel="icon">`, so phones show a generated letter-monogram tile (e.g. a colored "D") instead of the brand logo on the home screen / Chrome shortcuts. Discovered in production on davis9001.dev.

**Rule:** Every site built on NebulaKit must ship a complete icon set, not just a tab favicon. A single small favicon is **not** enough — home-screen tiles and PWA installs pull from `apple-touch-icon` and web-manifest icons, which the base template does not provide.

Required, generated from the site's logo:

- `apple-touch-icon.png` (180×180) — **static, solid background** (transparent renders as black on iOS). Match the site's `theme-color`.
- Manifest icons `icon-192.png` + `icon-512.png` and a `site.webmanifest` (`name`/`short_name`, `display: standalone`, `theme_color`/`background_color`).
- Tab favicon **light + dark variants** via `<link rel="icon" media="(prefers-color-scheme: dark|light)">`, with `favicon.ico`/`.svg` as the no-media default. Default to dark unless the brand says otherwise.
- `<link rel="apple-touch-icon">`, `<link rel="manifest">`, and `<meta name="apple-mobile-web-app-title">` in `src/app.html`.

Tiles and installed-app icons are **static** — they cannot switch on `prefers-color-scheme`; only the tab favicon can. Pick one default (dark) for the static assets. See [docs/INITIAL_CUSTOMIZATION.md](docs/INITIAL_CUSTOMIZATION.md) → Share Metadata And Icons for the checklist.

### 7. `/documentation` Must Match The Shipped App

**Failure mode:** A feature ships, `/documentation` still describes the previous app (or the NebulaKit template). Users follow instructions for a product that no longer exists, and the next AI session reads the stale page as truth.

**Rule:** [src/routes/documentation/+page.svelte](src/routes/documentation/+page.svelte) is this app's user-facing documentation, not template filler. Any change that adds, removes, or alters a **user-visible** feature — route, page, auth/setup step, command, integration, binding, env var, keyboard shortcut, admin capability — must update that page **in the same change**. Never defer it to a follow-up task.

**When this breaks:**

- New feature added → Update the matching section, add the nav anchor if it's a new section, and extend [tests/unit/documentation-page.test.ts](tests/unit/documentation-page.test.ts) to assert the new content (tests first — see §1).
- Feature removed or renamed → Delete or rewrite its docs in the same change. Stale instructions are a defect, not debt.
- `/documentation` route missing (deleted during customization) → Recreate it, with links from [src/lib/components/Footer.svelte](src/lib/components/Footer.svelte) and the command palette. "We removed the template docs" is not an exemption; replace, never drop.
- Docs page still says "NebulaKit" after customization → Rebrand it; see §5.
- Internal-only refactor with no user-visible change → No doc update needed. State that explicitly in the commit/PR rather than staying silent.

**Reference:** [docs/DOCUMENTATION_PAGE.md](docs/DOCUMENTATION_PAGE.md) — section map, scaffold for recreating the route, and the per-feature checklist.

### 8. Agent Discovery Surfaces Are A Contract

**Failure mode:** A site ships with no `/robots.txt` (or an invalid one with no `User-agent` line), no sitemap, and nothing machine-readable — so crawlers and AI agents can't find or correctly use it. Or worse: discovery files that advertise endpoints which don't exist, sending agents into failure loops that look like outages.

**Rule:** This template publishes a working agent-discovery layer. **Keep it accurate; never delete it.**

| Surface                                                   | Route                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `/robots.txt` — crawl rules, AI crawlers, Content Signals | [src/routes/robots.txt/](src/routes/robots.txt/+server.ts)                                                    |
| `/sitemap.xml` — static pages + published CMS content     | [src/routes/sitemap.xml/](src/routes/sitemap.xml/+server.ts)                                                  |
| `/.well-known/api-catalog` (RFC 9727)                     | [src/routes/\[x+2e\]well-known/api-catalog/](src/routes/[x+2e]well-known/api-catalog/+server.ts)              |
| `/.well-known/agent-skills/index.json`                    | [src/routes/\[x+2e\]well-known/agent-skills/](src/routes/[x+2e]well-known/agent-skills/index.json/+server.ts) |
| `/auth.md` — how agents authenticate                      | [src/routes/auth.md/](src/routes/auth.md/+server.ts)                                                          |
| `Accept: text/markdown` + `Link` headers                  | [src/hooks.server.ts](src/hooks.server.ts)                                                                    |
| WebMCP browser tools                                      | [src/lib/webmcp.ts](src/lib/webmcp.ts)                                                                        |

**The honesty rule:** only publish discovery metadata for capabilities that actually exist. This template deliberately ships **no** `oauth-authorization-server`, `oauth-protected-resource`, or MCP server card, because it is an OAuth _client_ with no MCP server — advertising them would point agents at endpoints that 404. Add them **when, and only when,** you build the real thing.

**When this breaks:**

- **New public page added** → Add it to `SITEMAP_ROUTES` in [src/lib/agent-discovery.ts](src/lib/agent-discovery.ts), or to `SITEMAP_EXCLUDED_ROUTES` with a reason. `tests/unit/agent-readiness.test.ts` fails until you do — that's intentional, not a flaky test.
- **API added, removed, or its auth changed** → Update the API catalog and any skill that documents it, in the same change.
- **Skill wording edited** → Nothing to do; digests are computed from the rendered bytes at request time.
- **Crawl or AI-training policy needs to change** → Edit `CONTENT_SIGNAL` / `CRAWLER_DISALLOW` in `src/lib/agent-discovery.ts`. Every robots.txt group picks it up. The shipped default is fully permissive (`ai-train=yes`) — **review this before launching a site with proprietary content.**
- **Tempted to rename `[x+2e]well-known`** → Don't. `[x+2e]` is SvelteKit's hex escape for `.`; a literal `.well-known/` directory routes fine but drops out of TypeScript's wildcard includes, so those files silently stop being type-checked.

**Reference:** [docs/AGENT_READINESS.md](docs/AGENT_READINESS.md) — full surface map, the DNS records that must be added by hand, and how to verify.

### 9. Credential Fields Carry A Site-Unique Name

**Failure mode:** Every site built from this template ships `id="password"` and `id="email"` on its login form. A password manager that matches on host rather than origin — two local projects on `localhost`, or sibling subdomains of one registrable domain — reads those forms as the same login and offers the wrong credentials.

**Rule:** Give every credential or secret input an `id`/`name` from `fieldName()` in [src/lib/utils/form-fields.ts](src/lib/utils/form-fields.ts). It prefixes with `site.slug`, so a new site gets unique fields the moment `bun run customize` sets the slug. Covered today: login, signup, the profile password + merge fields, `/setup`, and the admin AI-key and auth-key forms.

```svelte
const passwordField = fieldName('password');
<label for={passwordField}>Password</label>
<input id={passwordField} name={passwordField} type="password" autocomplete="current-password" />
```

**When this breaks:**

- **New form with an email, password, or key field** → Use `fieldName()` for `id` and `name`, keep `for` on the label in sync, and add the route to `CREDENTIAL_ROUTES` in [tests/unit/auth-field-names.test.ts](tests/unit/auth-field-names.test.ts). That test fails on any hardcoded `id`/`name`/`for` in those files.
- **Setting up a new site from the template** → The fields are only unique once `site.slug` is yours. `bun run customize` handles it and flips `credential_fields_unique` in [INITIAL_CUSTOMIZATION_STATUS.md](INITIAL_CUSTOMIZATION_STATUS.md); a hand-rename does not — check the slug yourself. See §5.
- **Tempted to rename the `autocomplete` token too** → Don't. `email`, `name`, `current-password`, and `new-password` are the standard values that make autofill work _correctly_. Prefix the identifiers only.
- **A field's value is a POST body key** (the contact form action) → Leave it alone. Renaming it breaks the server contract, and address autofill wants the plain `name`/`email` names there.

---

---

## Architecture Notes

- **Cloudflare-first:** D1 (DB), KV, R2, Queues, Workers AI. See [wrangler.toml](wrangler.toml).
- **Minimal dependencies:** Build features in-house. External packages only for complex/unsolvable cases.
- **SvelteKit + TypeScript:** Always use types. Never suppress TypeScript errors.
- **TDD cycle:** Red → Green → Refactor. Repeat for each feature.

---

_Every rule exists because something broke. If you find an undocumented failure, document it here._
