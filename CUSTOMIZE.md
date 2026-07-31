# The Set Path: New App From This Template

This is the canonical, ordered path for turning a fresh clone of this template into
your own app. Do it **before** feature work — otherwise the app, metadata, and
assistant guidance keep pointing back at the template.

The work splits in two:

- **Mechanical** (deterministic) — name, slug, dev port, repo, URL, Cloudflare
  resource names. Handled by one script: `bun run customize`.
- **Semantic** (needs judgment) — what your docs page says, which command-palette
  entries make sense, your brand assets. Guided here; a human or agent does it.

Everything the running app and dev tooling needs lives in **one file**:
[`src/lib/site.config.ts`](src/lib/site.config.ts). Vite, Playwright, and every
component import from it, so name/port/URL are never scattered again. The `customize`
script rewrites that file and syncs the surfaces that _can't_ import it (wrangler.toml,
tests, docs).

---

## Step 1 — Mechanical rename (`bun run customize`)

```bash
bun run customize          # interactive: prompts for each value, Enter keeps current
bun run customize --dry    # preview every file it would touch, writes nothing
```

It asks for (or, non-interactively, reads from `customize.config.json`):

| Value                     | Drives                                                            |
| ------------------------- | ----------------------------------------------------------------- |
| `name`                    | UI, page titles, OG/Twitter meta                                  |
| `shortName`               | Tab title, PWA `short_name`                                       |
| `slug`                    | Cloudflare resource names (`<slug>-db`, `<slug>-files`), pkg name |
| `devPort`                 | Local dev + preview + Playwright port                             |
| `tagline` / `description` | Footer/hero copy, meta description                                |
| `url`                     | Canonical + OG URLs                                               |
| `repo`                    | GitHub links (`owner/name`)                                       |
| `author` / `authorUrl`    | Footer attribution                                                |

**Non-interactive (agents / CI):** copy `customize.config.example.json` to
`customize.config.json`, edit it, run `bun run customize`. That file is gitignored
so it won't land in your product. Delete it afterward.

After it runs: `bun run check` and `bun run test` should still pass (a pure rename
changes values, not behavior).

---

## Step 2 — Cloudflare resources (semantic)

The script renames the resource _names_ in `wrangler.toml` but **cannot** create
real resources — it leaves the template's `database_id` / KV ids in place. Point the
app at your own:

```bash
wrangler d1 create <slug>-db          # paste the id into wrangler.toml [[d1_databases]]
wrangler kv namespace create KV       # paste id + preview_id into [[kv_namespaces]]
wrangler r2 bucket create <slug>-files
```

Then `bun run db:migrate:local` to apply migrations. See [SETUP.md](SETUP.md) for the
full deploy flow.

---

## Step 3 — Rewrite the documentation page (semantic)

[`src/routes/documentation/+page.svelte`](src/routes/documentation/+page.svelte) is
template prose about NebulaKit. Rewrite it to describe **your** app — features, setup,
usage. Keep the route (`/documentation`) or remove it and drop its palette + footer
entries. The unit test `tests/unit/documentation-page.test.ts` asserts on its content;
update it to match your rewrite.

---

## Step 4 — Refill the command palette (semantic)

The palette hardcodes its entries in
[`src/lib/components/CommandPalette.svelte`](src/lib/components/CommandPalette.svelte)
(the `$: commands` reactive block). When you add/remove routes, run:

```bash
bun run palette:scan
```

It audits `src/routes`, lists which routes the palette already links vs. which it's
missing, and prints ready-to-paste command objects for the gaps. **Paste selectively**
— some entries belong behind `isAuthenticated` / `canAccessAdmin` / `hasAIProviders`
gates. The scanner never edits the component; you curate.

---

## Step 5 — Brand assets & icon set (semantic)

Replace the visual identity. A tab favicon alone is **not** enough — phone home-screen
tiles and PWA installs read `apple-touch-icon` and the web manifest. Full checklist
(sizes, `app.html` wiring, light/dark tab favicons) is in
[docs/INITIAL_CUSTOMIZATION.md](docs/INITIAL_CUSTOMIZATION.md) → "Web-app icon set".
Assets to replace: `static/og-image.{png,svg}`, `static/favicon*.png`,
`static/apple-touch-icon.png`, `static/icon-{192,512}.png`, `static/site.webmanifest`.

---

## Step 6 — Mark it done

Set `status: complete` in
[INITIAL_CUSTOMIZATION_STATUS.md](INITIAL_CUSTOMIZATION_STATUS.md) once branding,
docs, and assets are yours. Assistants read that file to decide whether onboarding
still needs doing.

---

## Definition of done

- No user-facing surface calls itself NebulaKit (unless that's your app name).
- `bun run check` and `bun run test` pass.
- `wrangler.toml` points at **your** Cloudflare resources, not the template's.
- The docs page and command palette reflect your app, not the starter.
- Social shares use your own image and metadata.
- `INITIAL_CUSTOMIZATION_STATUS.md` says `status: complete`.

## What's centralized (so you rarely touch these by hand)

`src/lib/site.config.ts` is the single source of truth. Consumers:

- `vite.config.ts`, `playwright.config.ts` → `site.devPort`
- `SharingMeta.svelte` → `site.name` (default), `+page.svelte` → title/description
- `Navigation.svelte`, `Footer.svelte` → `site.name`, `repoUrl`, `site.author`
- `CommandPalette.svelte` → `site.name` in the docs entry
