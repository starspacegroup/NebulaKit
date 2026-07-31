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

---

## Architecture Notes

- **Cloudflare-first:** D1 (DB), KV, R2, Queues, Workers AI. See [wrangler.toml](wrangler.toml).
- **Minimal dependencies:** Build features in-house. External packages only for complex/unsolvable cases.
- **SvelteKit + TypeScript:** Always use types. Never suppress TypeScript errors.
- **TDD cycle:** Red → Green → Refactor. Repeat for each feature.

---

_Every rule exists because something broke. If you find an undocumented failure, document it here._
