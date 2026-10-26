# Making the Hero Yours

The home page hero in [`src/routes/+page.svelte`](../src/routes/+page.svelte) is
NebulaKit's: a nebula, stars, two planets, a chat bubble and a comet. It suits a
template named after space. It almost certainly does not suit your app. Replace it
before launch — a visitor reads the hero before anything else, and the template's
hero says "starter kit", not "your product".

This is Step 3b of the [set path](../CUSTOMIZE.md). It takes an hour or two. You
keep the structure and replace the picture.

## 1. Write the words first

The decoration serves the copy, so the copy comes first. Write three things:

- **The headline.** Your product's name, or a short claim. `site.name` is already
  wired into the `<h1>`.
- **One sentence** that says who it is for and what it does. Not a feature list.
  It replaces the "A full-stack SvelteKit + Cloudflare-native starter…" subtitle.
- **One primary action.** Sign up, start a chat, open the catalogue. Keep at most
  one secondary action beside it.

If you cannot write the sentence, the hero is not the problem yet.

## 2. Choose a motif from your product

Build the decoration from your product's own nouns, the way NebulaKit's is built
from a nebula. Ask "what would a page about this thing show if it could not use
words?" Some examples:

| Product           | Motif                                   |
| ----------------- | --------------------------------------- |
| Recipe site       | Ingredients drifting, steam rising      |
| Budgeting app     | Soft chart lines, coins, a rising curve |
| Music tool        | Waveforms, a slow pulse                 |
| Field-service app | A map grid, route lines, pins           |
| Writing tool      | Paper texture, a blinking cursor, ink   |
| Community / chat  | Speech bubbles, avatars meeting         |

Pick **one** motif. Three ideas at once read as clutter. Use two or three layers
of it at different depths, not ten different objects.

A plain hero is a valid choice: a strong headline on a quiet gradient beats a busy
picture that means nothing.

## 3. Know what to keep and what to replace

Inside `<div class="hero">`:

| Piece                                         | Do this                                                         |
| --------------------------------------------- | --------------------------------------------------------------- |
| `.hero` (full height, centred, gradient)      | Keep. Adjust the gradient.                                      |
| `.cosmic-bg` and everything in it             | Replace with your motif. Rename the class (`.hero-bg` is fine). |
| `.nebula-*`, `.star-sparkle`, `.stars-layer*` | Delete, unless your app is about space.                         |
| `.planet`, `.chat-bubble`, `.comet`           | Delete, unless your app is about space.                         |
| `.hero-shell` / `.hero-content`               | Keep. Change the words inside.                                  |
| The search box that opens the command palette | Keep if your app has many pages. Remove it if it does not.      |
| The action buttons                            | Keep. Point them at your routes.                                |

Delete the CSS for every piece you remove. The `<style>` block holds a lot of hero
CSS, and dead rules cost bytes on the most-visited page.

## 4. Follow the rules the template already follows

These keep the page fast, themed and accessible. They are not taste.

- **Colours from tokens only.** Use `var(--color-primary)`,
  `var(--color-secondary)`, `var(--color-background)`, `var(--color-surface)` and
  `color-mix()` on them. Then every theme in [THEME_SYSTEM.md](THEME_SYSTEM.md)
  works with no extra code. Never hard-code a hex colour in the hero.
- **Animate `transform` and `opacity` only.** No `border-radius`, `width`, `top`
  or `filter` in `@keyframes`. See [AGENTS.md](../AGENTS.md) — one such rule took
  the page from Lighthouse 100 to 60.
- **One blur, on a container.** Never a `filter` with a large `stdDeviation` per
  SVG path.
- **Decoration is hidden from assistive technology.** Put `aria-hidden="true"` on
  the background container. The words say what the page is.
- **Respect `prefers-reduced-motion`.** Stop or remove every animation under it.
  The still picture must look finished, not broken.
- **Keep the copy readable.** The decoration stays at the edges and behind the
  text, never under the headline at full strength. Check light **and** dark theme.
- **Mobile first.** At 375px wide, the headline and the primary action are visible
  without a scroll. Shrink or hide decoration pieces in the mobile media query.

## 5. Optional: make it alive

A static hero is fine. If you want more, the
[NebulaKit marketing site](https://nebulakit.starspace.group) uses a pattern you
can copy for any motif:

- A **seeded** layout module (plain TypeScript, so it is unit-tested): the server
  renders a still SVG from a fixed seed, and the page needs no script to look right.
- On mount, a canvas takes over. It picks a **fresh seed**, so each load shows a
  different arrangement, and the pieces arrive from an empty field so the swap is
  never seen.
- Large pieces get per-load offsets through CSS custom properties, applied with
  `translate` and `scale` so they compose with a `transform` animation.
- The canvas stops when off screen or in a background tab, and never starts under
  `prefers-reduced-motion`.

Do this only if the motif benefits from motion. Motion is a cost on every visit.

## 6. Update the tests and check it

- [`tests/unit/home-page.test.ts`](../tests/unit/home-page.test.ts) asserts the
  template's subtitle. Change it to assert your sentence and your primary action.
- Run `bun run check` and `bun run test`.
- Open the page in light and dark theme, at phone and desktop width, and with
  reduced motion on.
- Run Lighthouse on the home page (see
  [LIGHTHOUSE_MONITORING.md](LIGHTHOUSE_MONITORING.md)). Performance must not drop.

## Done when

- [ ] The headline, sentence and primary action are your product's.
- [ ] No nebula, planet, comet or chat bubble remains, unless you chose them.
- [ ] The decoration uses theme tokens and works in every theme.
- [ ] Only `transform` and `opacity` animate, and reduced motion stops them.
- [ ] `home-page.test.ts` asserts your copy, and `bun run test` passes.
- [ ] `hero_replaced: true` in [INITIAL_CUSTOMIZATION_STATUS.md](../INITIAL_CUSTOMIZATION_STATUS.md).
