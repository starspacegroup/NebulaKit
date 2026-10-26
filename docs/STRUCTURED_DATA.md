# Structured data (JSON-LD)

Open Graph and Twitter cards tell a social crawler what a page is. Search engines read schema.org
JSON-LD. `src/lib/seo/structured-data.ts` builds one `@graph` per page, and `SharingMeta.svelte` is
the only thing that renders it. A page gets structured data by using `SharingMeta`, which every
public page already does.

## What a page emits

Always: `Organization`, `WebSite`, and the page itself (`WebPage`, or the subtype a page asks for).
Then, when the page supplies them:

| Input                  | Node added                                                      |
| ---------------------- | --------------------------------------------------------------- |
| any sub-page           | `BreadcrumbList` (Home first); the home page has none           |
| `structured.items`     | `ItemList`, in render order, set as the page's `mainEntity`     |
| `structured.article`   | `Article` or `BlogPosting` (author falls back to organisation)  |
| `type="article"` props | An `Article` derived from `publishedTime`/`modifiedTime`/author |
| `structured.product`   | `Product` + one `Offer`; the page becomes an `ItemPage`         |
| `image`                | `ImageObject`, referenced as the page's primary image           |

Wired today: `/[contentType]` (CollectionPage + ItemList), `/[contentType]/[slug]` (BlogPosting for
the `blog` type, Article otherwise, tags as keywords), `/shop` (ItemList), `/shop/[slug]`
(Product/Offer), `/p/[slug]` (breadcrumb; a draft is `noindex` and emits nothing).

## Rules

- `@id`s come from `site.url`, never the request origin, so a preview deploy does not read as a
  second organisation. Customizing `site.url` re-pins every id.
- Emission goes through `escapeJsonLd`: `<`, `>`, `&`, U+2028 and U+2029 are written as `\uXXXX`.
  CMS titles reach the graph, so `</script>` in a title cannot break out of the element. Never
  build the `<script>` by hand; use `jsonLdScript`.
- `noindex` pages emit no graph. Pass `structured={null}` to opt a page out explicitly.
- Honesty: there is no `SearchAction`, because the site has no public search route with a shareable
  result URL (the command palette is an overlay). There is no `availability` on offers, because the
  shop keeps no stock count. If either changes, change the builder and its test together.
- The only `sameAs` is the GitHub repository from `site.repo`. Add the downstream organisation's
  real profiles in `organizationNode()` when customizing.

## Adding a page

Pass what the page knows:

```svelte
<SharingMeta title="Pricing" structured={{ breadcrumb: [{ name: 'Pricing', path: '/pricing' }] }} />
```

Verify with Google's Rich Results Test or validator.schema.org against a deployed URL. This repo's
tests check structure and escaping only; they do not check eligibility for rich results.
