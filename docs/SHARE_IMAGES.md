# Share images

When someone pastes a link to your site into Slack, X, Facebook, LinkedIn, iMessage or a chat, the
card that appears is built from the page's Open Graph and Twitter tags. Two rules for it:

1. **A shared link always has an image.** No page is ever shared as a bare link.
2. **The image is about this site.** Never another site's artwork, and when the page has a picture of
   its own, that picture.

## Which image a page gets

`resolveShareImage` (`src/lib/seo/share-image.ts`) decides, and `SharingMeta` is the only thing that
writes the tags:

| Page                    | Share image                                                     |
| ----------------------- | --------------------------------------------------------------- |
| A product (`/shop/x`)   | The product's photo                                             |
| An auction              | Its product's photo                                             |
| A CMS item              | Its SEO image, else its `featured_image` field                  |
| A builder page (`/p/x`) | The first picture on the page                                   |
| Everything else         | The site's default card (`site.ogImage`, `static/og-image.png`) |

The page's own image is used only when it is usable: an `http(s)` URL or a path on this site, and
**not an SVG**. Facebook, X and LinkedIn do not render an SVG as a share image, so a link with one
shows a blank card. An unusable image falls through to the next choice, then to the site default.
`og:image:width` and `height` are written only when known. The image is also in the page's JSON-LD.

## The default card is made for your site

`static/og-image.png` is generated from `src/lib/site.config.ts`: the name, the tagline, the address
and the accent colour (`emailTheme.accent`).

```bash
bun run og:generate
```

It writes `static/og-image.svg` (the layout) and `static/og-image.png` (1200 × 630, opaque RGB).
Headless Chromium does the rasterizing: `bunx playwright install chromium`, or set `CHROMIUM_PATH`.
Run it again whenever the name, tagline, URL or accent changes. `bun scripts/customize.mjs` runs it
for you.

The card is deliberately plain. If you have real brand artwork, replace the two files with it: it must
stay a 1200 × 630 PNG or JPEG, `site.ogImage.width` and `height` must match, and the tests below still
apply.

## What keeps it true

`tests/unit/share-images.test.ts` fails when:

- the default image is missing, is an SVG, is not the size the config declares, is over 5 MB, or has
  transparency (a crawler would draw its own colour behind it);
- `robots.txt` disallows the image's path;
- a site whose name is not NebulaKit still ships the stock NebulaKit artwork. The message says to run
  `bun run og:generate`;
- a public page renders no `SharingMeta`. Admin, setup and reset are exempt, with reasons, in that file.

## What it does not do

- **No per-page text cards.** `/privacy` and `/documentation` share with the site card, not a card with
  their own title. Rendering one on demand needs an image library in the Worker (satori and a wasm
  rasterizer), which is more than the free plan's size limit allows. If a site is on a paid plan and
  wants it, it is one route.
- **It cannot check an external photo is still there.** A product photo hosted elsewhere that is later
  deleted shares as a broken image until the product is edited.
- **Platforms cache share images,** often for days. After changing the default card, re-scrape a URL in
  Facebook's Sharing Debugger or LinkedIn's Post Inspector; X refreshes on its own schedule.

## Moving parts

- `src/lib/seo/share-image.ts`: `resolveShareImage`, `firstShareImage`, `firstDocumentImage`.
- `src/lib/components/SharingMeta.svelte`: writes the tags and the JSON-LD.
- `scripts/generate-og-image.mjs`, `scripts/lib/og-card.mjs` (layout), `scripts/lib/png.mjs`.
- Tests: `share-image`, `share-image-pages`, `share-images`, `og-card`, `SharingMeta`.
