# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**[AGENTS.md](AGENTS.md) is the canonical rules file** — coverage floor, migration immutability, CSS variables, scratch files, product identity, icon set, `/documentation` sync, and agent-discovery surfaces. Read it first; it is sized to fit the 200-line memory budget. This file holds the commands, architecture, and Claude-specific context that AGENTS.md deliberately leaves out, and cross-references its rules by section number rather than restating them.

## Commands

Package manager is **Bun** — `bun.lock` is the sole lockfile, CI installs with `bun install --frozen-lockfile`, and package-script orchestration uses `bun run`/`bunx` throughout.

```bash
bun run dev              # dev server on port 4277 (from src/lib/site.config.ts)
bun run build            # → .svelte-kit/cloudflare
bun run build:ci         # local CI compile; warns on intentional placeholder bindings
bun run check            # svelte-kit sync && svelte-check
bun run test             # vitest run
bun run test:coverage    # vitest run --coverage — fails below 95% (the real gate)
bun run test:e2e         # db:migrate:local, then playwright
bun run validate:contrast   # WCAG contrast check over src/app.css themes
bun run validate:all     # check + test + validate:contrast
bun run deploy           # build + wrangler pages deploy
```

Single test: `bunx vitest run tests/unit/cms-service.test.ts` or `bunx vitest run -t "creates a content item"`.

There is **no `lint` or `format` script**. Prettier + `prettier-plugin-svelte` are installed with `.prettierrc`/`.prettierignore` in place — run `bunx prettier --write .` or `bunx prettier --check .` directly. The workspace table also lists this project's dev port as "default"; it is **4277**, set in `site.config.ts` and read by both Vite and Playwright.

`.github/copilot-instructions.md` defers to AGENTS.md and adds one rule of its own — assume a dev server is already running on 4277, don't start another. That rule is scoped to Copilot Chat, not to Claude Code; start the dev server yourself when you need it, after checking 4277 is free.

Setup / maintenance scripts (`scripts/`): `setup:cf` (create the Cloudflare D1/KV/R2 resources and write real ids into `wrangler.toml`), `check:bindings`, `db:migrate` / `db:migrate:local` / `db:migrate:list`, `palette:scan`, `tunnel` / `dev:tunnel` (cloudflared).

### Coverage: one gate, 95, in `vite.config.ts`

`vite.config.ts` sets vitest `thresholds` of **95** for lines, functions, branches, and statements — so `test:coverage`, and therefore CI's coverage step, fails below 95 on all four. This matches AGENTS.md §1. There is deliberately no second gate: CI used to carry a `jq` step nominally checking 90% that read a `coverage-summary.json` nothing generated, so it always passed. Don't reintroduce a number outside the thresholds block — that split is what let the docs drift to 90 while the real floor was 95.

## Architecture

SvelteKit 2 + **Svelte 5** (`^5.56.8`) + TypeScript run on Cloudflare Pages (`@sveltejs/adapter-cloudflare`). Existing components largely use Svelte's legacy-compatible `export let`, `$:`, and store syntax; match the surrounding file unless a deliberate migration is in scope. Bindings come in through `event.platform.env`: `DB` (D1), `KV`, and `BUCKET` (R2). There is no ORM; database access uses parameterized D1 statements (`src/lib/utils/db.ts`).

**`src/lib/site.config.ts` is the single source of truth for identity.** Name, slug, tagline, `devPort: 4277`, production URL, repo, author. `vite.config.ts` and `playwright.config.ts` both import it directly, which is why the file must stay dependency-free (no `$app`, no Node APIs) — adding an import there breaks the build config. Surfaces that _can't_ import it (`wrangler.toml`, tests, docs, `src/app.html`, `static/site.webmanifest`) are updated **by hand, in the same change** — there is no rebranding script. `tests/unit/product-identity.test.ts` reads README, FEATURES, `site.config.ts`, `/documentation`, `app.html`, and the manifest off disk and fails when they drift; that failure is intentional.

**`src/hooks.server.ts` — the sequence order is load-bearing.**

```
sequence(usageHandler, agentDiscoveryHandler, authHandler, pageViewsHandler)
```

- `usageHandler` first, so requests that return early still count against the Cloudflare plan meter (it counts _every_ invocation, buffered in-process and flushed on a rate limit).
- `pageViewsHandler` last, so `locals.user` is populated and `signed_in` is accurate. It counts only non-bot HTML `GET` 200s on matched, non-`/admin|/api|/setup` routes.
- `agentDiscoveryHandler` sits _outside_ that pair so `pageViewsHandler` still sees a `text/html` response and keeps counting agent reads as views.

Each handler is exported individually because `sequence()` needs Kit's request store — unit tests call them directly. Reordering silently corrupts analytics rather than failing a test.

**CMS is registry-driven.** Content types are declared in `src/lib/cms/registry.ts`, synced to D1 on first access, and the routes generate themselves: `src/routes/[contentType]/`, `[contentType]/[slug]/`, and `admin/cms/[type]/`. Adding a type means adding a definition object, not adding routes. Embeds are split on purpose: `src/lib/cms/embeds/manifest.ts` carries metadata with **zero `.svelte` imports** so Workers, Vitest, and browser code can all load it; `embeds/index.ts` holds the actual components.

**Auth is hand-rolled — there is no auth library in the request path.** The browser receives a signed opaque session token (`src/lib/utils/session.ts`), while its digest and expiry live in D1. Per-provider OAuth route pairs under `src/routes/api/auth/{github,discord}/` persist and atomically consume one-time state transactions; email/password lives at `login`, `signup`, and `password`. Identity and admin flags are re-read from D1 on every request in `authHandler`, so revocation and role changes take effect without a re-login. Provider availability is resolved from `platform.env` or KV `auth_config:<provider>`; account linking lives in `src/lib/services/account-merge.ts`. `@auth/core` and `@auth/sveltekit` were declared dependencies that nothing imported — removed. Don't re-add them without actually wiring Auth.js in.

**Agent discovery** (robots.txt, sitemap, `.well-known/`, `auth.md`, Markdown content negotiation, WebMCP) — see AGENTS.md §8, which is the full contract including the honesty rule about not advertising endpoints that don't exist. `tests/unit/agent-readiness.test.ts` fails when a new public route isn't registered in `src/lib/agent-discovery.ts`; that failure is intentional.

**`wrangler.toml` ships placeholder resource ids that fail loudly by design.** `bun run dev` warns, `bun run build` fails, and remote migration/deploy paths fail until the ids are safe. `bun run build:ci` is the local-only exception: it warns and compiles without contacting Cloudflare. A previous version shipped real ids and six sibling products inherited one D1 and one KV, including shared OAuth secrets. Run `bun run setup:cf` rather than pasting ids from a sibling project.

### Test topology

- Two homes: colocated `src/**/*.test.ts` and the bulk in `tests/unit/`. Both are in the vitest `include`. E2E is `tests/e2e/` (Playwright, excluded from vitest).
- Coverage **excludes** `**/*.svelte`, `src/routes/**/+page.ts`, `src/lib/site.config.ts`, `scripts/`, and `.remember/` tool scratch data. Authorization hooks are measured directly. The 95% floor therefore applies to product `.ts` logic; component tests exist and run, but do not count toward it.
- `poolOptions.threads.singleThread: true` and `unstubGlobals: true`. The latter is not optional: several suites stub `crypto` with a bare `{ randomUUID }`, and on a single-threaded pool that object leaks into every later _file_ without it. Symptom is a suite that passes alone and fails in a full run.

## Claude-specific

- **Task tracking:** use `TaskCreate` / `TaskUpdate` / `TaskList` for multi-step work — mark in-progress before starting and completed immediately after, not in batches.
- **Scratch files** go to `.llm-outputs/` (AGENTS.md §4). The directory exists and is gitignored.
- **NebulaKit is a product, not a starter template** (AGENTS.md §5). The retired customization workflow is deliberately gone. Don't reintroduce template onboarding, rebrand scripts, or branding-status ledgers, and don't describe the repository that way in docs.
- **Shared history with siblings:** `Guides`, `nabu`, and `sortalizer` share historical code with this repo. A security or correctness fix here likely applies there too and may warrant an explicit cross-repository audit; see Related Projects in AGENTS.md.
