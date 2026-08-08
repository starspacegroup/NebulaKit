# NebulaKit Constraints & Rules

**Canonical source of truth for all AI assistants working on this codebase.**

## Start Here

Before changing anything:

1. Read this file, [tasks/goals.md](tasks/goals.md), and [tasks/todo.md](tasks/todo.md).
2. Run `git status --short --branch`. This repository is often edited by multiple agents. Treat all
   pre-existing changes as user-owned; never discard, rewrite, or stage them implicitly.
3. Inspect the implementation, tests, and user-facing documentation. Executable behavior is more
   authoritative than filenames or stale prose.
4. Use Bun and the scripts in [package.json](package.json), not npm, pnpm, or ad hoc substitutes.
5. Keep [tasks/todo.md](tasks/todo.md) aligned with evidence. Local checks, hosted CI, merged state,
   and deployed Cloudflare behavior are separate facts.

See [CLAUDE.md](CLAUDE.md) for the command list, repository map, and architecture details. The local
dev port is `4277`, from [src/lib/site.config.ts](src/lib/site.config.ts). Do not start a second dev
server when one is already running.

## Critical Constraints

### 1. Test-Driven Development: 95% Coverage Floor

Every feature, bug fix, or refactor requires tests first. Run the smallest focused test, then the
proportional broader gates. `bun run test:coverage` must keep lines, functions, branches, and
statements at or above 95%. Do not ship untested critical paths or lower the threshold to pass.

Tests may be colocated as `src/**/*.test.ts` or live in `tests/unit/`; browser tests live in
`tests/e2e/`.

### 2. Immutable Database Migrations

Never edit, delete, reorder, or renumber a migration that exists on `main`; D1 tracks applied
filenames. Add the next `migrations/NNNN_description.sql`, run `bun run db:migrate:local`, and add
focused migration-sensitive tests. See [migrations/README.md](migrations/README.md).

### 3. No Hardcoded CSS Colors

Use CSS custom properties from [src/app.css](src/app.css), never hardcoded hex, `rgb()`, or named
colors. Add new light/dark tokens there first and run `bun run validate:contrast`. See
[docs/THEME_SYSTEM.md](docs/THEME_SYSTEM.md).

### 4. Scratch Files

Put test logs, debug traces, generated analysis, and all temporary files in `.llm-outputs/`, which is
already ignored. Do not commit scratch artifacts.

### 5. Stable Product Identity

NebulaKit is an independent Cloudflare-native product, not a starter template. Do not add template
customization scripts, placeholder branding ledgers, or downstream-app instructions. An intentional
identity change must update `src/lib/site.config.ts`, README, `/documentation`, metadata, and
share/install assets together, with tests.

### 6. Complete Web App Icon Set

Do not reduce the product to a favicon. Keep all of these logo-derived assets and declarations:

- `static/apple-touch-icon.png` at 180x180 with a solid brand background.
- `static/icon-192.png`, `static/icon-512.png`, and `static/site.webmanifest`.
- Light/dark tab favicons selected by `prefers-color-scheme`, plus a no-media default.
- Apple touch icon, manifest, and mobile app title declarations in `src/app.html`.

Installed-app icons are static and use the dark cosmic treatment; only tab favicons switch theme.

### 7. `/documentation` Matches Shipped Behavior

Any user-visible route, page, auth/setup step, command, integration, binding, environment variable,
shortcut, or admin capability change must update
[src/routes/documentation/+page.svelte](src/routes/documentation/+page.svelte) and its focused test in
the same change. Stale instructions are a defect. Internal-only refactors require no docs update.
See [docs/DOCUMENTATION_PAGE.md](docs/DOCUMENTATION_PAGE.md).

### 8. Agent Discovery Is a Contract

Keep `/robots.txt`, `/sitemap.xml`, `/.well-known/api-catalog`,
`/.well-known/agent-skills/index.json`, `/auth.md`, Markdown negotiation headers, and WebMCP accurate.
Only advertise capabilities, routes, and permissions that exist. NebulaKit is an OAuth client and
does not currently publish OAuth-server or MCP-server metadata.

New public pages must be added to `SITEMAP_ROUTES` or intentionally excluded in
[src/lib/agent-discovery.ts](src/lib/agent-discovery.ts). API or authentication changes must update
the catalog and applicable skills. Keep `[x+2e]well-known`; the escape ensures TypeScript includes
those routes. See [docs/AGENT_READINESS.md](docs/AGENT_READINESS.md).

## Security Boundaries

- Never trust profile, role, owner, link, or authorization state from a request body or client
  cookie. Sessions are opaque and revocable; reload identity and privileges from D1.
- Authentication and authorization fail closed when D1, KV, required secrets, or provider
  configuration are unavailable.
- OAuth state is expiring, one-time, server-persisted, and session-bound for account linking. Keep
  atomic consumption and reject replay, provider mismatch, and open redirects.
- Reuse owner/admin guards in `src/lib/server/`. Hidden UI is not authorization; enforce policy in
  server loads and handlers.
- Sanitize CMS rich text on create and update before `{@html}`. Validate typed URLs and embeds, and
  fail closed when rendering legacy values.
- Minimize PII in APIs and logs. Reveal remains an explicit, audited, short-lived owner-only action.
- Use parameterized D1 statements. Never interpolate user input into SQL, HTML, redirects, headers,
  or provider requests.
- Never print, commit, or copy credentials, tokens, signing secrets, `.dev.vars`, or real Cloudflare
  resource IDs. Use checked-in placeholders and `bun run setup:cf`.

## Architecture Invariants

- Cloudflare runtime state comes from `event.platform.env`: D1 (`DB`), KV (`KV`), and R2 (`BUCKET`).
  Do not assume a writable filesystem, long-lived process, or global bindings.
- The installed Svelte runtime is 5.x. Existing components largely use legacy-compatible `export
  let`, `$:`, and stores; match the surrounding file unless a tested migration is in scope.
- Keep `sequence(usageHandler, agentDiscoveryHandler, authHandler, pageViewsHandler)` in
  `src/hooks.server.ts`; accounting and identity depend on that order.
- CMS is registry-driven. Add content types in `src/lib/cms/registry.ts`, not parallel routes. Keep
  `.svelte` imports out of `src/lib/cms/embeds/manifest.ts`.
- Keep `src/lib/site.config.ts` dependency-free because Vite and Playwright import it directly.
- Prefer platform APIs and existing utilities. Add dependencies only when their maintenance,
  security, and bundle costs are justified.

## Verification

Run focused checks while iterating, then finish with gates proportional to the touched surface:

- Source/configuration: `bun run check` and focused tests.
- Every feature, fix, or refactor: `bun run test:coverage`.
- Auth, session, OAuth, owner/admin, CMS sanitization, PII, setup/reset, or catalog: focused security
  tests plus full coverage.
- User-visible behavior: focused tests, check, coverage, relevant E2E/contrast, and documentation.
- Migrations: local migration plus focused tests; never mutate a migration already on `main`.
- Touched Markdown, Svelte, TypeScript, JSON, and config: `bunx prettier --check <files>`.
- Final diff: `git diff --check` and path-scoped review before staging or reporting completion.

Use `bun run build:ci` for a local compile with placeholder bindings. A production `bun run build`,
binding validation, deployment, live OAuth flow, hosted CI, or external scan passes only when that
exact evidence was observed. Record unavailable credentials, runtime, or account access as missing
evidence, never as a pass.

## Working Agreement

- Keep changes scoped. Do not reformat, rename, delete, or clean unrelated dirty files.
- Never stage the whole repository in a shared dirty worktree.
- Do not edit generated `.svelte-kit/`, `build/`, `coverage/`, or Playwright artifacts.
- Comments explain non-obvious security, ordering, or platform constraints, not obvious code.
- When prose and behavior disagree, verify behavior, fix the mismatch, and test the contract.
- Shared-history fixes may require separate audits in Guides, nabu, and sortalizer; never stage
  sibling-repository files here.

_Every rule exists because something broke. Add only verified constraints._
