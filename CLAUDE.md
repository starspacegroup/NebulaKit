# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**[AGENTS.md](AGENTS.md) is the canonical rules file** — coverage floor, migration immutability, CSS variables, scratch files, product identity, icon set, `/documentation` sync, and agent-discovery surfaces. Read it first; it is sized to fit the 200-line memory budget. This file holds the commands, architecture, and Claude-specific context that AGENTS.md deliberately leaves out, and cross-references its rules by section number rather than restating them. `§N` means the **Nth bullet of AGENTS.md's "Release Rules" list**, in order. Renumbering that list is expensive: `git grep -ln "AGENTS.md §"` currently returns 14 tracked files, four of them shipped source (`src/lib/agent-discovery.ts`, `src/lib/server/agent-skills.ts`, `src/routes/[x+2e]well-known/api-catalog/+server.ts`, `src/routes/auth.md/+server.ts`) plus `vite.config.ts`, `ci.yml`, two docs, and five test files. Re-run that grep before touching the list.

AGENTS.md also opens by requiring `tasks/goals.md` and `tasks/todo.md` be read before editing, alongside `git status --short --branch`. Both files are checked in and carry the current work ledger; uncommitted changes in the tree are user-owned and must never be discarded, rewritten, or staged implicitly.

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

**Auth is hand-rolled — there is no auth library in the request path.** The browser receives a signed opaque session token (`src/lib/utils/session.ts`), while its digest and expiry live in D1. Per-provider OAuth route pairs under `src/routes/api/auth/{github,discord}/` persist and atomically consume one-time state transactions; email/password lives at `login`, `signup`, and `password`. Identity and admin flags are re-read from D1 on every request in `authHandler`, so revocation and role changes take effect without a re-login. Provider availability is resolved from `platform.env` or KV `auth_config:<provider>`; account linking lives in `src/lib/services/account-merge.ts`. Authorization checks belong in `src/lib/server/auth-guards.ts` and are reused from there rather than re-derived per route — server loads and API handlers each guard themselves, because hiding UI is not authorization. `@auth/core` and `@auth/sveltekit` were declared dependencies that nothing imported — removed. Don't re-add them without actually wiring Auth.js in.

**Agent discovery** (robots.txt, sitemap, `.well-known/`, `auth.md`, Markdown content negotiation, WebMCP) — see AGENTS.md §8, which is the full contract including the honesty rule about not advertising endpoints that don't exist. `tests/unit/agent-readiness.test.ts` fails when a new public route isn't registered in `src/lib/agent-discovery.ts`; that failure is intentional.

**`wrangler.toml` ships placeholder resource ids that fail loudly by design.** `bun run dev` warns, `bun run build` fails, and remote migration/deploy paths fail until the ids are safe. `bun run build:ci` is the local-only exception: it warns and compiles without contacting Cloudflare. A previous version shipped real ids and six sibling products inherited one D1 and one KV, including shared OAuth secrets. Run `bun run setup:cf` rather than pasting ids from a sibling project.

### Migrations

`migrations/` is D1-native — wrangler sorts `.sql` files by numeric prefix and then by string, and records applied ones in `d1_migrations` **by filename**. A filename already on `main` is already applied and is immutable (AGENTS.md §2, `migrations/README.md`). The sequence runs `0001_`–`0012_`, the next is `0013_`.

Numbering is the part that actually goes wrong here. An earlier state of this branch had two files sharing a `0010_` prefix, because the new pair was numbered from the branch's own highest file rather than from what was already on `origin/main`. Ordering between same-prefix files falls to the string comparison, not the number, which is not what anyone reading `NNNN_` expects. **Take the next number from `origin/main`, not from your branch** — and if a collision does land, it is only fixable while the colliding files are still branch-local and unapplied to any remote D1.

`scripts/db-migrate.mjs` reads `database_name` out of `wrangler.toml` and refuses to run against a placeholder — but **only for remote runs**. Line 63 exempts `--local` (`/REPLACE_ME/.test(name) && !LOCAL`), and `check-bindings.mjs` is invoked with `--warn` in that path. That exemption is load-bearing: it is what lets `db:migrate:local`, and therefore `test:e2e`, work on a fresh clone before `setup:cf` has ever run. Don't "fix" it. The remote strictness is the point — shared-database migrations are how one D1 once accumulated four projects' interleaved tables.

### Reference docs

`docs/` holds the long-form design notes that source comments cite by path — `hooks.server.ts` itself points at two of them. Read the relevant one before changing a subsystem:

| Subsystem                                              | Doc                                                         |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| Page-view stats, admin stats surface                   | `ADMIN_STATS.md`                                            |
| Agent discovery, Markdown negotiation, WebMCP          | `AGENT_READINESS.md`                                        |
| D1/KV/R2 provisioning, the shared-resource incident    | `CLOUDFLARE_SETUP.md`                                       |
| CMS embed registry and manifest split                  | `CMS_EMBEDS.md`                                             |
| Command palette + per-item visibility                  | `COMMAND_PALETTE.md`                                        |
| `/documentation` route (kept in sync per AGENTS.md §7) | `DOCUMENTATION_PAGE.md`                                     |
| GitHub OAuth pair                                      | `GITHUB_AUTH.md`                                            |
| Local dev, `.dev.vars`                                 | `LOCAL_SETUP.md`                                            |
| Payments / purchasing-power pricing                    | `PAYMENTS_AND_PPP.md`                                       |
| TDD expectations behind the coverage gate              | `TDD_WORKFLOW.md`                                           |
| Theme tokens, contrast validation (AGENTS.md §3)       | `THEME_SYSTEM.md`, `THEME_IMPLEMENTATION_SUMMARY.md`        |
| Chat / voice surfaces                                  | `UNIFIED_CHAT_INTERFACE.md`, `VOICE_CHAT_IMPLEMENTATION.md` |

### Test topology

- Two homes: colocated `src/**/*.test.ts` and the bulk in `tests/unit/`. Both are in the vitest `include`. E2E is `tests/e2e/` (Playwright, excluded from vitest).
- Coverage **excludes** `**/*.svelte`, `src/routes/**/+page.ts`, `src/lib/site.config.ts`, `scripts/`, and `.remember/` tool scratch data. Authorization hooks are measured directly. The 95% floor therefore applies to product `.ts` logic; component tests exist and run, but do not count toward it.
- `pool: 'threads'` with `fileParallelism: false` (test files run one at a time, not concurrently), plus `unstubGlobals: true`. The last one is not optional: several suites stub `crypto` with a bare `{ randomUUID }`, and because files share a worker serially that object leaks into every later _file_ without it. Symptom is a suite that passes alone and fails in a full run.

## Claude-specific

- **Task tracking:** use `TaskCreate` / `TaskUpdate` / `TaskList` for multi-step work — mark in-progress before starting and completed immediately after, not in batches.
- **Scratch files** go to `.llm-outputs/` (AGENTS.md §4). The directory exists and is gitignored.
- **NebulaKit is a product, not a starter template** (AGENTS.md §5). The retired customization workflow is deliberately gone. Don't reintroduce template onboarding, rebrand scripts, or branding-status ledgers, and don't describe the repository that way in docs.
- **Shared history with siblings:** `Guides`, `nabu`, and `sortalizer` share historical code with this repo. A security or correctness fix here likely applies there too and may warrant an explicit cross-repository audit; see Related Projects in AGENTS.md.
