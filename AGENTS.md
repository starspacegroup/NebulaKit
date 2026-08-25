# NebulaKit Rules

Canonical constraints for coding agents. Read `tasks/goals.md` and `tasks/todo.md`, inspect the
current implementation and tests, and run `git status --short --branch` before editing. Existing
changes are user-owned: never discard, rewrite, or stage them implicitly. Use Bun. `CLAUDE.md` owns
the command list, repository map, and architecture explanation.

## Release Rules

- Write focused tests for every feature, fix, or refactor. `bun run test:coverage` must keep lines,
  functions, branches, and statements at or above 95%; never lower the threshold to pass.
- Migrations already on `main` are immutable. Add the next sequential migration, run the local D1
  migration gate, and add migration-sensitive tests. See `migrations/README.md`.
- Use theme tokens from `src/app.css`, not hardcoded colors. Add light and dark values together and
  run contrast validation. See `docs/THEME_SYSTEM.md`.
- Put logs, generated analysis, debug traces, and temporary files in ignored `.llm-outputs/`.
- NebulaKit is an independent product, not a starter template. Do not restore customization scripts,
  placeholder-branding ledgers, or downstream-app instructions.
- Preserve the complete logo-derived install set: Apple touch icon, 192/512 manifest icons,
  `site.webmanifest`, light/dark tab favicons, and the declarations in `src/app.html`. Installed-app
  icons are static; only tab favicons switch theme.
- User-visible route, setup, command, binding, environment, integration, shortcut, or admin changes
  must update `/documentation` and its focused test in the same change. Internal refactors do not.
- Keep robots, sitemap, API catalog, agent skills, `auth.md`, Markdown negotiation, and WebMCP honest.
  Add public pages to `SITEMAP_ROUTES` or explicitly exclude them. NebulaKit is an OAuth client, not
  an OAuth or MCP server. Keep `[x+2e]well-known`; the escape preserves TypeScript inclusion.

## Security Boundaries

- Never trust profile, role, ownership, linking, or authorization state from request bodies or
  client cookies. Production sessions are opaque and revocable; reload identity and privileges from
  D1 on every request.
- Auth fails closed when D1, KV, required secrets, or provider configuration are unavailable.
- OAuth state is expiring, one-time, server-persisted, and session-bound for account linking. Keep
  atomic consumption and reject replay, provider mismatch, and open redirects.
- Reuse `src/lib/server/auth-guards.ts`. Hidden UI is not authorization; guard server loads and API
  handlers. Owner-only operations must not accept ordinary admins.
- Sanitize CMS rich text on every create/update before storage and again at the render boundary for
  legacy rows. Keep URL and embed validation canonical; `{@html}` must never receive unsanitized CMS
  content.
- Minimize PII in APIs and logs. Reveal is explicit, audited, short-lived, and owner-only.
- Parameterize D1 statements. Never interpolate user input into SQL, HTML, redirects, headers, or
  provider requests.
- Never print, commit, or copy credentials, tokens, secrets, `.dev.vars`, or real Cloudflare resource
  IDs. Checked-in binding IDs remain placeholders; provision with `bun run setup:cf`.

## Load-Bearing Invariants

- Runtime bindings come from `event.platform.env`; do not assume a writable filesystem, global
  bindings, or a long-lived process.
- Keep `sequence(usageHandler, agentDiscoveryHandler, authHandler, pageViewsHandler)` in
  `src/hooks.server.ts`; accounting and identity depend on that order.
- CMS is registry-driven through `src/lib/cms/registry.ts`. Do not add parallel content routes or put
  `.svelte` imports in `src/lib/cms/embeds/manifest.ts`.
- Keep `src/lib/site.config.ts` dependency-free because Vite and Playwright import it directly.
- Credential and secret inputs take their `id`/`name` from `fieldName()` in
  `src/lib/utils/form-fields.ts`, which prefixes `site.slug`. Bare identifiers let a password
  manager that matches on host — `localhost`, or a sibling subdomain — offer another deployment's
  credentials. Keep the standard `autocomplete` tokens. `tests/unit/auth-field-names.test.ts`
  fails on a hardcoded `id`, `name`, or `for` in a credential route.
- Match surrounding Svelte syntax unless a tested Svelte 5 migration is explicitly in scope.
- Add dependencies only when their security, runtime, bundle, and maintenance costs are justified.

## Verification

Run focused tests while iterating. For source changes, finish with `bun run check`, full coverage,
touched-file Prettier, and `git diff --check`; add security, migration, E2E, contrast, or documentation
gates when those surfaces change. `bun run build:ci` is only a placeholder-binding compile: never
report production bindings, deployment, live OAuth, hosted CI, or external scans as passing without
observing that exact evidence.

Keep changes scoped. Do not edit generated `.svelte-kit/`, `build/`, `coverage/`, or Playwright
artifacts. Never stage the whole repository. When prose and behavior disagree, verify behavior and
fix the tested contract. Shared-history fixes in Guides, nabu, or sortalizer require separate audits.

_Add rules only for verified, non-obvious failure modes._
