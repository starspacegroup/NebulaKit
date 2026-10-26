# SEO landing pages

Hand-written pages that each answer one kind of search, in five families:

| Family  | Default route   | Answers                                     |
| ------- | --------------- | ------------------------------------------- |
| `who`   | `/who/<slug>`   | A kind of customer: "website for a bakery"  |
| `where` | `/where/<slug>` | A place the business has a real tie to      |
| `what`  | `/what/<slug>`  | One service: "bike tune-up"                 |
| `when`  | `/when/<slug>`  | A situation: "flat tire", "site got hacked" |
| `why`   | `/why/<slug>`   | One checkable reason to choose the business |

Each family has a hub (`/who`) that lists its pages. Ported from the davis9001.com landing pages
(2026-10-24), made generic. The general SEO rules are in [SEO_GUIDE.md](SEO_GUIDE.md); this file is
the landing-page system and its rules.

## The rules

Google's spam policies name **doorway pages** and **scaled content abuse**: many pages made mainly
to rank, which say the same thing with one word swapped. A site caught doing it can lose rankings
for every page, not only the landing pages. These rules keep the pages on the right side of that,
and the audit enforces the ones a machine can check.

1. **Every page is hand-written.** Nothing generates page prose — not a template with a name
   swapped, not a model. The scaffold writes empty fields. Before writing a page, ask: does it say
   something true and useful that no other page says? If it only changes a noun, do not add it.
   _Audit: fails on a repeated title, H1, lede, meta description, section body or FAQ answer
   anywhere on the site (case and spacing ignored)._
2. **No type × region pages.** "Restaurants in Springfield" next to "Restaurants in Shelbyville"
   is the classic doorway pattern. Put place content on the region page and type content on the
   type page. _Audit: fails a non-region page whose slug, title or H1 names a region page._
3. **A region page needs a real tie.** The business is based there, has an office there, has done
   the work there, or the owner has family there. No tie, no page — search volume is not a tie.
   _Audit: fails a region page without `tie.note`._
4. **Every claim is literally true.** No invented clients, results, statistics or credentials.
   "Many" when it is many, not "every". _Audit: flags percentages, money, multipliers and any
   number of two or more digits unless the exact phrase is in `verifiedNumbers` (per page or
   site-wide) — add a phrase only after checking it against a source._
5. **Uncertain claims are marked, not published.** Put `TODO(owner): confirm …` in the page's
   `notes` (never rendered); the audit lists these as TODOs. A `TODO(` inside rendered text fails
   the audit, because it would show on the page.
6. **FAQ markup matches the page word for word.** The visible FAQ and the FAQPage JSON-LD are
   built from one array (`FaqSection` + `faqJsonLd`). _Tested._
7. **No LocalBusiness or street address in markup unless the address is public on the site.**
   The provider is an `Organization` until `publicAddress` is set in the site config.
   _Tested._
8. **Enough of its own content.** At least three sections and three FAQ items by default
   (`limits`), titles up to 70 characters and descriptions up to 170.
9. **Placeholder content never ships.** While `example: true`, pages show an "example content"
   notice, carry `noindex`, and are left out of `sitemap.xml`. With `example: false`, the audit
   fails on any remaining "Example Co." text.

## Files

| Path                                          | What                                                     |
| --------------------------------------------- | -------------------------------------------------------- |
| `src/lib/landing/types.ts`                    | The page and site schema                                 |
| `src/lib/landing/families.ts`                 | Default labels per family; `defineFamilies` overrides    |
| `src/lib/landing/routing.ts`                  | Lookup, paths, canonical URLs, sitemap, legacy redirects |
| `src/lib/landing/jsonld.ts`                   | Service + BreadcrumbList + FAQPage; hub CollectionPage   |
| `src/lib/landing/audit.ts`                    | The guardrails as `auditLanding(site)`                   |
| `src/lib/landing/scaffold.ts`                 | Stub and index text for the CLI                          |
| `src/lib/landing/content/site.ts`             | **This site's config** — edit it                         |
| `src/lib/landing/content/pages/<family>/*.ts` | **One file per page** — write them                       |
| `src/lib/components/landing/`                 | `LandingHub`, `LandingPageView`                          |
| `src/routes/[family=landingFamily]/`          | Hub and page routes for every configured family          |
| `src/params/landingFamily.ts`                 | Matches configured prefixes and legacy prefixes only     |
| `scripts/landing.ts`                          | `bun run landing new / index / report`                   |
| `tests/unit/landing-guardrails.test.ts`       | Runs the audit on this site's content                    |
| `tests/unit/landing-module.test.ts`           | Tests the module itself                                  |

One route pair serves every family, so changing a prefix is a config change, not a new route
directory. Landing paths join `SITEMAP_ROUTES` in `src/lib/agent-discovery.ts` through
`landingSitemapRoutes(LANDING)`.

## Using it on a new site

1. Open `src/lib/landing/content/site.ts`. Set `cta`, `ogImage` if you have one, and the families
   you use in `defineFamilies({ … })` with your own labels and hub copy. Leave out a family you do
   not need. Delete the example pages you will not keep.
2. Start each page with `bun run landing new <family> <slug>`. It writes an empty draft with
   `draft: true` and TODO markers, and rebuilds `content/pages/index.ts`. Drafts are not routed.
3. Write every field by hand. Put anything you have not checked in `notes` as
   `TODO(owner): …`. Add region `tie`s. Add number phrases to `verifiedNumbers` only once checked.
   Remove `draft: true`.
4. Run `bun run landing report` (errors and TODOs), then `bun run test`, `bun run check` and
   `bun run build`.
5. When no Example Co. page is left, set `example: false`. The pages lose `noindex` and enter the
   sitemap. Submit `/sitemap.xml` in Search Console and Bing Webmaster Tools, and request indexing
   for the hubs.

After deleting or renaming page files by hand, run `bun run landing index`.

## Renaming a family prefix

Set the new `prefix` and list the old one in `legacyPrefixes`:

```ts
who: { prefix: 'who', legacyPrefixes: ['for'] }
```

`/for` and `/for/<slug>` then answer `301` to `/who` and `/who/<slug>`, keeping the query string.
Keep the legacy entry for as long as old links may exist. The audit fails if two families claim the
same prefix.

## Not done by this module

- It writes no prose and never will (rule 1).
- Page-specific CTAs, prices and badges are site code. Put them in `extra`, `checks` or `related`,
  or wrap `LandingPageView` in your own component.
- Search Console, Bing Webmaster Tools and measuring rankings are manual steps for the owner.
