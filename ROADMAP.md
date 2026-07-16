# NebulaKit Roadmap

Planned additions to the kit, sourced primarily from features built downstream in
NebulaKit-derived projects that proved generalizable. Each entry names the source
project and the paths to lift from, so implementation starts from working code.

Downstream projects surveyed (2026-07-06):

| Project       | Location                                                | Divergence from kit                                             |
| ------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| Nabu          | `~/_Projects/StarSpace/Nabu/nabu`                       | Large — media/AI-generation platform                            |
| AgapeVerse    | `~/_Projects/AgapeVerse/agapeverse-nebulakit`           | Large — payments/credits consumer app                           |
| Atlas         | `~/_Projects/StarSpace/Atlas/Atlas`                     | Near-stock                                                      |
| Arizona       | `~/_Projects/davis9001/Arizona/arizona-nebulakit`       | Near-stock (removed the simulated-SSO "PRETEND" providers)      |
| davis9001.dev | `~/_Projects/davis9001/Website/davis9001.dev-sveltekit` | Large — CMS v2 (WYSIWYG + Svelte embeds + R2 media), task board |

## Upstream candidates — new modules

### Payments: Stripe integration + PPP region pricing (from AgapeVerse)

A complete, kit-shaped Stripe module: checkout, product/price/discount management from
the admin area, appearance matching the kit theme system, and — as a **first-class
concept, not a bolt-on — purchasing-power-parity (PPP) region pricing**. Full design in
[`docs/PAYMENTS_AND_PPP.md`](./docs/PAYMENTS_AND_PPP.md); read it before starting this.

- `src/lib/components/StripeCheckoutForm.svelte`
- `src/lib/utils/stripe.ts`, `stripe-config.ts`, `stripe-appearance.ts`
- **PPP region pricing:** `src/lib/utils/region-pricing.ts` (country→currency map,
  zero-decimal/whole-unit formatting, geo via `cf-ipcountry`, per-currency amount
  table), `scripts/setup-region-prices.ts` (add-only writer of Stripe
  `currency_options`; refuses live keys without `--live`), `src/lib/utils/fx.ts`
  (admin-preview USD reference). Key architecture: PPP rides on `currency_options` of
  **existing** prices — no new price IDs, no migration, entitlement/webhook logic
  untouched. The AgapeVerse amount table is HeartPoints-specific; generalize it into
  app-defined price roles (see the design doc).
- Admin UI: `src/routes/admin/stripe/` (products, discounts) and
  `src/routes/api/admin/stripe-*` (config, bootstrap, products, prices, coupons,
  promotion-codes, options)
- The `stripe-bootstrap` endpoint (idempotent first-time product/price setup) fits the
  kit's zero-env-setup philosophy (`docs/ZERO_ENV_SETUP.md`).

### Credits / points ledger (from AgapeVerse)

AgapeVerse's "heartpoints" is a general credits system under a domain name: balance,
append-only transaction ledger, purchase via Stripe, weekly allowance cron, and an admin
transactions view. Upstream as a generic **credits** module.

- `src/lib/utils/heartpoints.ts`, `heartpoint-ledger.ts`, `src/lib/utils/db/heartpoints.ts`
- `src/routes/api/heartpoint-transactions/`, `src/routes/admin/heartpoint-transactions/`
- `src/routes/api/cron/weekly-heartpoint-allowance/`
- Pairs with the Stripe module (`account/buy-heartpoints` flow).

### Media library on R2 (from Nabu)

Upload, gallery, detail modal, and a file archive service over the kit's existing R2
binding — the missing "user uploads" story.

- `src/lib/components/MediaUpload.svelte`, `MediaGallery.svelte`, `ImageDetailModal.svelte`,
  `FileArchive.svelte`
- `src/lib/services/file-archive.ts`, `media-history.ts`, `src/lib/utils/attachments.ts`
- `src/routes/api/archive/` (+ `file`, `ai-save`)

### CMS v2: WYSIWYG richtext + Svelte component embeds (from davis9001.dev)

> **Status: ✅ shipped (2026-07-12), with improvements.** The TipTap WYSIWYG,
> Svelte embed system, and R2 media pipeline are all in the kit and tested.
> Beyond a straight port, the embed system gained **typed props** (schema-driven
> auto-generated editor form, no raw-JSON editing), **one-step registration**
> (drop a folder under `src/lib/cms/embeds/<name>/` — auto-discovered via
> `import.meta.glob`), and **SSR embeds** (eager component registry). Write-path
> hardening (`sanitizeRichtextFields`, using `xss`) runs on every create/update.
> A brand-neutral **Callout** reference embed ships as a live example (the
> davis9001 Dirac physics embeds were intentionally left downstream). See
> [docs/CMS_EMBEDS.md](./docs/CMS_EMBEDS.md). **Remaining:** the opt-in
> markdown-blog-import recipe (item 4 below) is not yet ported.

**Goal: the kit's CMS grows up.** davis9001.dev took the registry-driven CMS and made
authoring actually pleasant — a real WYSIWYG editor, live Svelte components embedded
inside richtext content, and an R2 image pipeline wired into the editor. Bring the
whole system into the kit, and improve it where the downstream version cut corners.
This is the flagship CMS upgrade; land it before the smaller CMS backports below.

What downstream built (three commits: `60daa7e` TipTap WYSIWYG, `dfe12f7` Svelte
embed system, `852f16c` R2 media pipeline):

1. **TipTap WYSIWYG for `richtext` fields** — replaces raw markdown textareas.
   Round-trips stored HTML, hardened write path (server-side sanitize on save,
   not just render).
   - `src/lib/components/RichTextEditor.svelte`
   - `src/lib/cms/sanitize.ts`, `richtext-utils.ts`
2. **Svelte embed system** — authors drop _real, interactive Svelte components_
   into content. Stored as inert placeholder divs
   (`<div data-svelte-embed="name" data-props="...">`), so content stays plain
   sanitizable HTML in D1:
   - `src/lib/cms/embed.ts` — the single placeholder codec, pure string logic
     (runs in Workers, Vitest, browser — no DOM)
   - `src/lib/cms/richtext-embed-extension.ts` — TipTap atom node; renders as a
     non-editable card with props-edit/remove (live component is NOT mounted in
     the editor — keeps editing cheap and predictable)
   - `src/lib/cms/embeds/manifest.ts` — embed metadata, deliberately free of
     `.svelte` imports; `embeds/index.ts` — the name → component map
   - `src/lib/components/CmsContent.svelte` — public renderer: parses stored HTML
     into html/embed segments and mounts the real components
   - Sanitizer allowlists the placeholder shape; unknown embed names render as
     nothing rather than breaking the page
   - Reference embeds: the Dirac physics visualizations (`src/lib/cms/embeds/dirac/`)
     prove the pattern with canvas animation + interactivity
3. **R2 media pipeline** — image upload from inside the editor, served from the
   kit's R2 binding (`src/lib/cms/upload.ts` + media routes). Overlaps the
   "Media library on R2 (from Nabu)" entry above — reconcile into ONE media
   module that both the CMS editor and the archive/gallery consume.
4. **Blog-as-CMS pattern** — markdown blog imported into the CMS
   (`src/lib/cms/blog-import.ts`, migration `0010`), old routes 308-redirected.
   Ship as an opt-in import script + a documented "retire your markdown blog"
   recipe.

Make it better in the kit ("maybe even better"):

- **Typed embed props.** Downstream edits props as raw JSON. Give `EmbedDefinition`
  a props schema (zod or JSON Schema) and auto-generate the props form in the
  editor card — validation for free, no JSON hand-editing.
- **One-step embed registration.** Manifest + component map is two files to keep
  in sync; collapse to a single registration (or glob-discover `embeds/*/`)
  so adding an embed is one file drop, matching the content-type registry's
  "add it to the array, that's it" ethos.
- **Optional live preview.** The card-not-component tradeoff is right as a default,
  but offer a per-embed `preview: true` that mounts the real component (or a
  sandboxed iframe) inside the editor for visual-critical embeds.
- **SSR the embeds where possible** so embedded components paint with the page
  instead of popping in on hydrate.
- **Theme-token aware.** Reference embeds should consume the kit's theme system
  (design tokens) rather than hardcoded colors, so they look native in any app.
- **Revision history tie-in.** Pairs with the "revision-history pattern" entry
  below — richtext + embeds are exactly the fields you want revert for.
- **Reconcile with AgapeVerse's `escapeHtml` XSS hardening** (see Backports) so the
  kit ships one coherent sanitize story: escape on render, sanitize on write,
  allowlisted embed placeholders.

### AI generation provider framework (from Nabu)

Pluggable text/image/video generation behind a provider registry, with job status and
progress. Extends the kit's existing LLM chat + admin ai-keys pages.

- `src/lib/services/ai-text-generation.ts`, `ai-media-generation.ts`,
  `video-provider.ts`, `video-registry.ts`
- Providers: `src/lib/services/providers/openai-video.ts`, `wavespeed-video.ts`,
  `src/lib/services/video/veo3.ts`
- UI: `src/lib/components/AIGenerateModal.svelte`, `AITextQuickGenerate.svelte`
- Admin ai-keys extensions: reorder + per-provider validate/pricing endpoints
  (`src/routes/api/admin/ai-keys/{reorder,wavespeed-validate,wavespeed-pricing}`)

### Chat upgrades: attachments + persisted conversations (from Nabu)

- `ChatAttachment`/`MediaAttachment` types with generating/complete/error status and
  progress on messages (`src/lib/stores/chatHistory.ts`, `ChatInterface.svelte`,
  `ChatSidebar.svelte`)
- Server-persisted conversations: `src/routes/api/chat/conversations/`

### Admin: PII privacy mode (from AgapeVerse)

Masks personal data in admin views by default, with an explicit reveal action —
a good default for any kit app with an admin area.

- `src/lib/components/admin/ObfuscatedText.svelte`, `ObfuscatedAvatar.svelte`,
  `PiiPrivacyToggle.svelte`
- `src/lib/server/pii-mask.ts`, `src/routes/api/admin/pii-reveal/`

### Admin: user impersonation (from AgapeVerse)

Log in as a user for support/debugging, with an explicit stop/exit.

- `src/routes/api/auth/impersonation/` (+ `stop`)
- Session plumbing in `src/lib/utils/auth-session.ts`

### Admin: stats dashboard & user management (from AgapeVerse)

- `src/routes/admin/stats/`, `src/routes/admin/user/`

### System prompts admin (from AgapeVerse)

Manage LLM system prompts from the admin area with a test-generate loop — natural
companion to the kit's chat UI.

- `src/lib/utils/db/system-prompts.ts`, `src/routes/admin/system-prompts/`,
  `src/routes/api/admin/system-prompts/` (+ `test-generate`)

### Contact form + submissions inbox (from AgapeVerse)

Public contact form (Turnstile-protected) with an admin review queue.

- `src/routes/api/contact-form-submissions/`, `src/routes/admin/contact-form-submission(s)/`,
  `src/lib/utils/db/contacts.ts`

### Onboarding flow (from Nabu)

Chat-driven guided onboarding with progress tracking.

- `src/lib/components/OnboardingChat.svelte`, `OnboardingProgress.svelte`
- `src/lib/services/onboarding.ts`, `src/lib/stores/onboarding.ts`, `src/lib/types/onboarding.ts`

### External connections / publishing framework (from Nabu)

OAuth "connect account" pattern (`src/routes/api/connect/{google,devto,linkedin}`) plus
pluggable publishers (`src/lib/services/publishers/{devto,linkedin}.ts`) and scheduling
(`ScheduleManager.svelte`). Upstream the connect + publisher interfaces; ship dev.to /
LinkedIn as reference implementations.

### Cron endpoint pattern (from AgapeVerse)

`src/routes/api/cron/` convention wired to Cloudflare cron triggers in `wrangler.toml`,
with a shared auth guard. Document + scaffold in the kit.

## Upstream candidates — smaller components & utils

- **NewVersionBanner** (AgapeVerse `src/lib/components/NewVersionBanner.svelte`) —
  "a new deploy is live, refresh" banner; pairs with Cloudflare's frequent deploys.
- **GoogleFontPicker** (Nabu `src/lib/components/GoogleFontPicker.svelte`) — theme-system
  companion.
- **ColorHarmonyWheel / BrandColorEditor** (Nabu) — color tooling for the theme system;
  wheel is generic, editor may stay brand-specific.
- **PricingSection** (Nabu `src/lib/components/PricingSection.svelte` + `utils/pricing.ts`) —
  standard marketing pricing block; pairs with the Stripe module.
- **Revision-history pattern** (Nabu `text-history.ts`, `media-history.ts`,
  `TextRevisionHistory.svelte`; AgapeVerse keeps versions too) — generic
  "field revisions with revert" service + UI.
- **Discord webhook notifications** (AgapeVerse `src/lib/utils/discord.ts`) — tiny ops
  notifier for signups/purchases/errors.
- **display-name.ts** (AgapeVerse) — safe public display-name derivation.
- **oauth-state.ts** (AgapeVerse) — signed OAuth `state` handling; review against the
  kit's current auth flow and upstream the hardening.

## Backports — fixes made downstream to kit files

- **account-merge: configurable table list** (Nabu `src/lib/services/account-merge.ts`) —
  downstream apps add tables keyed by `user_id`; Nabu introduced
  `USER_ID_TRANSFER_TABLES` (+ an admin-status check). Kit should make the transfer
  table list a documented extension point instead of a hardcoded set.
- **theme store: defensive localStorage access** (AgapeVerse `src/lib/stores/theme.ts`) —
  guards for SSR/disabled-storage environments before touching `localStorage` /
  `matchMedia`.
- **cms XSS hardening** (AgapeVerse `src/lib/cms/utils.ts`) — `escapeHtml` for rendered
  content; reconcile with the kit's newer `showInCommandPalette` normalization (changes
  went both directions).
- **Simulated-SSO "PRETEND" providers** (kit `AuthProviderButtons.svelte`,
  `utils/session.ts`) — Arizona stripped this dev-only affordance. Decide: keep behind a
  dev flag or remove from the kit; it shouldn't require downstream deletion.

## Process note

Atlas and Arizona are near-stock, so template drift is manageable today. When modules
above land in the kit, sync them into those two first — they're effectively free
upgrades there, while Nabu/AgapeVerse will need per-file reconciliation.
