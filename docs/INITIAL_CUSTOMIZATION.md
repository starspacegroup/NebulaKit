# Initial Template Customization

> **Start with the ordered set path in [CUSTOMIZE.md](../CUSTOMIZE.md).** It runs the
> mechanical rename for you (`bun run customize`) and sequences the semantic steps.
> This file is the deep reference for the branding/asset details that path points to
> — especially the web-app icon set below.

Do this before feature work, bug fixes, or content entry. The repository still contains NebulaKit template branding and template documentation. If you skip this step, the app, metadata, and assistant guidance will keep pointing back to the template.

## Goals

- Rename the app from NebulaKit to your actual product name.
- Replace the default social sharing and favicon assets.
- Replace NebulaKit-specific documentation content so users do not see template docs in your product — the `/documentation` route stays, its content becomes yours.
- Mark the work as complete in [INITIAL_CUSTOMIZATION_STATUS.md](../INITIAL_CUSTOMIZATION_STATUS.md).

## Required Checklist

- [ ] Replace visible app branding.
- [ ] Replace Open Graph, Twitter, and favicon assets.
- [ ] Generate the full web-app icon set (apple-touch-icon, manifest icons, light/dark favicons) — see below. A tab favicon alone is not enough; phone home-screen tiles need it.
- [ ] Rewrite the `/documentation` route and its links for your product (replace the content; keep the route).
- [ ] Update [INITIAL_CUSTOMIZATION_STATUS.md](../INITIAL_CUSTOMIZATION_STATUS.md) to `status: complete`.

## High-Value Files To Review

### Branding

- [README.md](../README.md)
- [src/routes/+page.svelte](../src/routes/+page.svelte)
- [src/lib/components/Navigation.svelte](../src/lib/components/Navigation.svelte)
- [src/lib/components/Footer.svelte](../src/lib/components/Footer.svelte)
- [src/lib/components/SharingMeta.svelte](../src/lib/components/SharingMeta.svelte)
- [src/routes/privacy/+page.svelte](../src/routes/privacy/+page.svelte)
- [src/routes/terms/+page.svelte](../src/routes/terms/+page.svelte)

### Share Metadata And Icons

- [static/og-image.png](../static/og-image.png)
- [static/og-image.svg](../static/og-image.svg)
- [static/favicon.svg](../static/favicon.svg)
- [src/app.html](../src/app.html)
- [src/routes/+page.svelte](../src/routes/+page.svelte)
- [src/lib/components/SharingMeta.svelte](../src/lib/components/SharingMeta.svelte)

**Web-app icon set (required — a tab favicon alone is not enough).** Home-screen tiles and PWA installs ignore `<link rel="icon">`; they read `apple-touch-icon` and the web manifest. Without them, phones render a generated letter-monogram tile instead of the logo. From the site logo, generate and wire up:

- `static/apple-touch-icon.png` (180×180) — **solid background** (transparent → black on iOS); match `theme-color`.
- `static/icon-192.png`, `static/icon-512.png`, and `static/site.webmanifest` (`name`/`short_name`, `display: standalone`, `theme_color`/`background_color`).
- Light + dark tab favicons (`static/favicon-dark.png` / `static/favicon-light.png`) selected via `<link rel="icon" media="(prefers-color-scheme: …)">`, with a no-media default (default to dark).
- In `src/app.html`: `<link rel="apple-touch-icon">`, `<link rel="manifest">`, `<meta name="apple-mobile-web-app-title">`.

Tiles and installed-app icons are static and cannot follow `prefers-color-scheme` — only the tab favicon switches. Reference implementation: davis9001.dev-sveltekit `src/app.html` + `static/`. See AGENTS.md §6.

### Template Documentation Removal Or Replacement

- [src/routes/documentation/+page.svelte](../src/routes/documentation/+page.svelte)
- [src/lib/components/Footer.svelte](../src/lib/components/Footer.svelte)
- [src/lib/components/CommandPalette.svelte](../src/lib/components/CommandPalette.svelte)
- [README.md](../README.md)
- [docs/ZERO_ENV_SETUP.md](./ZERO_ENV_SETUP.md)
- [docs](.)

## Recommended Workflow

1. Pick the final product name, slug, dev port, and short tagline.
2. Run `bun run customize` (or `--dry` first). This rewrites [src/lib/site.config.ts](../src/lib/site.config.ts) and search-and-replaces the old name/slug/port/repo/URL across the UI, tests, docs, and `wrangler.toml`. See [CUSTOMIZE.md](../CUSTOMIZE.md).
3. Point `wrangler.toml` at your own Cloudflare resources (the script renames them but can't create them — see CUSTOMIZE.md Step 2).
4. Replace the social image and favicon assets with your own files (see the icon-set section above).
5. Rewrite the `/documentation` route for your app, and curate the command palette with `bun run palette:scan`. **Replace its content — do not delete the route.** From here on it must track every user-visible feature you add; see [DOCUMENTATION_PAGE.md](./DOCUMENTATION_PAGE.md) and AGENTS.md §7.
6. Update [INITIAL_CUSTOMIZATION_STATUS.md](../INITIAL_CUSTOMIZATION_STATUS.md) to `status: complete` when done.

## Definition Of Done

- No user-facing page still presents itself as NebulaKit unless that is your actual app name.
- Social shares use your own image, alt text, and metadata.
- Users cannot navigate to NebulaKit template documentation from the product UI.
- `/documentation` still exists, describes your app's real features, and is linked from the footer and command palette.
- [INITIAL_CUSTOMIZATION_STATUS.md](../INITIAL_CUSTOMIZATION_STATUS.md) says `status: complete`.
