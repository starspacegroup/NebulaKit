# NebulaKit Rules

These are the canonical rules for coding agents.

Before you edit a file, do these steps:

1. Read `tasks/goals.md` and `tasks/todo.md`.
2. Read the current code and tests.
3. Run `git status --short --branch`.

Changes that exist before you start belong to the user. Do not discard them. Do not rewrite them. Do
not stage them. Use Bun for all commands. `CLAUDE.md` has the command list, the repository map, and
the architecture.

## Release Rules

- Write focused tests for every feature, fix, and refactor. `bun run test:coverage` must keep lines,
  functions, branches, and statements at 95% or higher. Never lower the threshold to make a test
  pass.
- Migrations that are already on `main` are immutable. Add the next sequential migration. Run the
  local D1 migration gate. Add migration-sensitive tests. See `migrations/README.md`.
- Use theme tokens from `src/app.css`. Do not hardcode colors. Add the light value and the dark value
  together. Run contrast validation. See `docs/THEME_SYSTEM.md`.
- Put logs, generated analysis, debug traces, and temporary files in the ignored `.llm-outputs/`
  directory.
- NebulaKit is a starter template. People create apps from it with "Use this template". Keep the
  customization path working: `bun run customize`, `CUSTOMIZE.md`, `INITIAL_CUSTOMIZATION_STATUS.md`,
  and `docs/INITIAL_CUSTOMIZATION.md`. Keep the branding ledger accurate. Do not delete it.
- Keep the complete set of logo-derived install files: the Apple touch icon, the 192 and 512 manifest
  icons, `site.webmanifest`, the light and dark tab favicons, and their declarations in
  `src/app.html`. Installed-app icons are static. Only the tab favicons change with the theme.
- Update `/documentation` and its focused test in the same change when you change any of these
  user-visible items: route, setup step, command, binding, environment variable, integration,
  shortcut, or admin page. An internal refactor does not need this update.
- Keep these surfaces accurate: robots, sitemap, API catalog, agent skills, `auth.md`, Markdown
  negotiation, and WebMCP. Add each public page to `SITEMAP_ROUTES`, or exclude it explicitly.
  NebulaKit is an OAuth client. It is not an OAuth server and not an MCP server. Keep the folder name
  `[x+2e]well-known`. The escape keeps the folder in the TypeScript build.
- A screenshot of another website ships as a pair: one capture in the light mode of that site and one
  capture in its dark mode. Show the capture that matches the current theme of this page. Switch on
  `[data-theme='dark']` on `<html>`. Do not switch on `prefers-color-scheme`. The user toggle
  overrides the operating system. After a toggle, `<picture media="(prefers-color-scheme: dark)">`
  shows the wrong capture. Give both images the same size and the same `alt` text. If the site has
  only one mode, say this beside the single image.

## Security Boundaries

- Do not trust profile, role, ownership, linking, or authorization state from request bodies or client
  cookies. Production sessions are opaque and revocable. Reload identity and privileges from D1 on
  every request.
- When D1, KV, a required secret, or the provider configuration is unavailable, authentication must
  fail closed.
- OAuth state expires, works one time, is stored on the server, and is bound to the session for
  account linking. Keep the atomic consumption. Reject a replay, a provider mismatch, and an open
  redirect.
- Reuse `src/lib/server/auth-guards.ts`. Hidden UI is not authorization. Guard every server load and
  every API handler. An owner-only operation must not accept an ordinary admin.
- Sanitize CMS rich text on every create and every update, before you store it. Sanitize it again at
  the render boundary, for legacy rows. Keep URL validation and embed validation canonical. Never
  give unsanitized CMS content to `{@html}`.
- Never trust an amount from the client. The server computes prices, discounts, tax, shipping, totals,
  and currency from the catalog and the site settings. The amount of a PaymentIntent is the total of
  the order. Only the signed and deduplicated Stripe webhook marks an order paid. See
  `docs/CHECKOUT.md`. The money core is proved in `dafny/PaymentCore.dfy`.
- Minimize PII in APIs and logs. A reveal of PII must be explicit, audited, short-lived, and
  owner-only.
- Parameterize D1 statements. Never put user input into SQL, HTML, redirects, headers, or provider
  requests.
- Never print, commit, or copy credentials, tokens, secrets, `.dev.vars`, or real Cloudflare resource
  IDs. The binding IDs in the repository stay as placeholders. Provision with `bun run setup:cf`.

## Load-Bearing Invariants

- Runtime bindings come from `event.platform.env`. Do not assume a writable filesystem, global
  bindings, or a long-lived process.
- Keep `sequence(usageHandler, agentDiscoveryHandler, authHandler, pageViewsHandler)` in
  `src/hooks.server.ts`, with `auditHandler` immediately before `authHandler`. Accounting and
  identity depend on this order.
- The CMS is registry-driven through `src/lib/cms/registry.ts`. Do not add parallel content routes.
  Do not put `.svelte` imports in `src/lib/cms/embeds/manifest.ts`.
- Keep `src/lib/site.config.ts` free of dependencies. Vite and Playwright import it directly.
- Credential and secret inputs take their `id` and `name` from `fieldName()` in
  `src/lib/utils/form-fields.ts`. This function adds `site.slug` as a prefix. A bare identifier lets
  a password manager that matches on host offer the credentials of another site. The host can be
  `localhost` or a sibling subdomain. The fields are unique only when the slug belongs to the
  downstream app. `bun run customize` sets the slug and sets `credential_fields_unique` in the
  branding ledger. Keep the standard `autocomplete` tokens. `tests/unit/auth-field-names.test.ts`
  fails when a credential route has a hardcoded `id`, `name`, or `for`.
- Match the Svelte syntax of the surrounding code. Change it only for a tested Svelte 5 migration that
  is explicitly in scope.
- The hero decoration in `src/routes/+page.svelte` animates `transform` and `opacity` only. One
  `filter: blur()` on `.nebula-waves-svg` softens its nebula SVG. Do not put a filter on each path.
  Both rules are load-bearing. A `border-radius` in `@keyframes blob-float` repaints two blurred
  500x600 elements in every frame. `preserveAspectRatio="slice"` scales the 400-unit viewBox about 4
  times, so a `stdDeviation` of 40 on a path becomes a blur kernel of about 160px. Each of these
  faults alone added about 10 seconds of total blocking time. The Lighthouse score fell from 100 to 60.
- Admin dates and times use the helpers in `src/lib/utils/timezone.ts` (`formatDate`, `formatTime`,
  `formatDateTime`, `dayKey`). Use the zone from `data.timeZone` in the admin layout. Admin numbers use
  `formatNumber`. A bare `toLocaleString()` call uses the zone and locale of the machine. It shows the
  wrong clock and causes a hydration mismatch. `tests/unit/admin-timezone.test.ts` fails on a bare call
  in `src/routes/admin` or `src/lib/components/admin`. The `tz` cookie is untrusted input. Only
  `resolveTimeZone` may read it. See `docs/ADMIN_TIMEZONE.md`.
- Add a dependency only when its security, runtime, bundle, and maintenance costs are justified.

## Verification

Run focused tests while you work. For source changes, finish with these steps:

1. `bun run check`
2. The full coverage run
3. Prettier on the files you touched
4. `git diff --check`

Add security, migration, E2E, contrast, or documentation gates when your change touches those
surfaces.

`bun run build:ci` compiles with placeholder bindings only. Do not report any of these items as
passing unless you observed the exact evidence: production bindings, deployment, live OAuth, hosted
CI, or external scans.

Keep changes in scope. Do not edit the generated `.svelte-kit/`, `build/`, `coverage/`, or
Playwright artifacts. Never stage the whole repository. When the text and the behavior disagree,
verify the behavior and fix the tested contract. A fix in shared history (Guides, nabu, or
sortalizer) needs a separate audit.

_Add a rule only for a verified failure mode that is not obvious._
