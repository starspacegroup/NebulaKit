# Initial Template Customization

Do this before feature work, bug fixes, or content entry. The repository still contains NebulaKit template branding and template documentation. If you skip this step, the app, metadata, and assistant guidance will keep pointing back to the template.

## Goals

- Rename the app from NebulaKit to your actual product name.
- Replace the default social sharing and favicon assets.
- Remove or replace NebulaKit-specific documentation surfaces so users do not see template docs in your product.
- Mark the work as complete in [INITIAL_CUSTOMIZATION_STATUS.md](../INITIAL_CUSTOMIZATION_STATUS.md).

## Required Checklist

- [ ] Replace visible app branding.
- [ ] Replace Open Graph, Twitter, and favicon assets.
- [ ] Generate the full web-app icon set (apple-touch-icon, manifest icons, light/dark favicons) — see below. A tab favicon alone is not enough; phone home-screen tiles need it.
- [ ] Remove or replace template documentation routes and links.
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

1. Pick the final product name and preferred short tagline.
2. Search for template branding with `rg -n "NebulaKit|starspacegroup/NebulaKit|/documentation|og-image|favicon" .`.
3. Replace visible branding in the UI, metadata, docs, legal text, and links.
4. Replace the social image and favicon assets with your own files.
5. Remove the `/documentation` route and any navigation or command palette entries that point to template docs, or replace them with your own product docs.
6. Update [INITIAL_CUSTOMIZATION_STATUS.md](../INITIAL_CUSTOMIZATION_STATUS.md) when complete.

## Definition Of Done

- No user-facing page still presents itself as NebulaKit unless that is your actual app name.
- Social shares use your own image, alt text, and metadata.
- Users cannot navigate to NebulaKit template documentation from the product UI.
- [INITIAL_CUSTOMIZATION_STATUS.md](../INITIAL_CUSTOMIZATION_STATUS.md) says `status: complete`.
