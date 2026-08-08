# CMS Svelte Embeds

NebulaKit's CMS lets authors drop **live, interactive Svelte components** into
richtext content. Embeds are stored inside the HTML as inert placeholders, so
content stays plain, sanitizable HTML in D1:

```html
<div data-svelte-embed="callout" data-props='{"variant":"info"}'></div>
```

The public renderer (`CmsContent.svelte`) parses those placeholders and mounts
the real components; the editor (`RichTextEditor.svelte`) shows them as
non-editable cards with a **Props** button. Everything else in the richtext is
sanitized on write (`sanitizeRichtextFields`), and the sanitizer allow-lists the
placeholder shape.

A brand-neutral **Callout** embed ships as a working reference. Use it as a
template for your own.

## Adding an embed (one step)

Create one folder under `src/lib/cms/embeds/<name>/`. It's auto-discovered — no
central list to edit.

```
src/lib/cms/embeds/
  <name>/
    definition.ts     # metadata + typed props schema (no .svelte import)
    <Name>.svelte      # the component that renders in published content
```

- `<name>` (the folder name) is the embed id, stored in `data-svelte-embed`. It
  must be kebab-case (`^[a-z0-9-]+$`) and match `definition.name`.
- Exactly one `.svelte` component per folder; it's mapped to the embed by folder
  name.

### 1. `definition.ts`

```ts
import { defineEmbed } from '../props-schema';

export const definition = defineEmbed({
	name: 'callout',
	label: 'Callout',
	description: 'A highlighted note box.',
	props: [
		{
			key: 'variant',
			label: 'Variant',
			type: 'select',
			default: 'info',
			options: [
				{ label: 'Info', value: 'info' },
				{ label: 'Warning', value: 'warning' }
			]
		},
		{ key: 'title', label: 'Title', type: 'string', default: 'Note' }
	]
});
```

`defineEmbed` fills `defaultProps` from the schema automatically, so a new embed
is a single declaration.

### 2. `<Name>.svelte`

Read the props as component exports and style with the kit's theme tokens so the
embed looks native in any app (light or dark). Avoid `onMount`-only rendering so
the embed paints during SSR.

```svelte
<script lang="ts">
	export let variant: 'info' | 'warning' = 'info';
	export let title = '';
</script>

<aside class="callout callout-{variant}">
	<strong>{title}</strong>
</aside>
```

That's it — the embed now appears in the editor's **Insert embed** picker, gets
an auto-generated props form, renders live on published pages, and survives
write-time sanitization.

## Typed props

Each prop field in the schema (`src/lib/cms/embeds/props-schema.ts`) has a
`type`:

| `type`    | Editor control | Coercion                                   |
| --------- | -------------- | ------------------------------------------ |
| `string`  | text input     | `String(value)`; missing → default         |
| `number`  | number input   | `Number(value)`; non-finite → default      |
| `boolean` | checkbox       | truthy of `true` / `'true'` / `'on'` / `1` |
| `select`  | dropdown       | must be one of `options`, else → default   |

The editor renders the form from the schema (no hand-editing JSON), and
`coerceProps` / `validateProps` guarantee stored props match their declared
types. Embeds with **no** `props` schema fall back to the raw-JSON props editor.

## How it fits together

| File                               | Role                                                         |
| ---------------------------------- | ------------------------------------------------------------ |
| `cms/embed.ts`                     | Placeholder codec + `parseContentSegments` (pure, no DOM)    |
| `cms/embeds/props-schema.ts`       | Prop types, coercion/validation, `defineEmbed`               |
| `cms/embeds/manifest.ts`           | Auto-discovers `definition.ts` files → `embedManifest`       |
| `cms/embeds/index.ts`              | Auto-discovers `.svelte` files → `getEmbedComponent` (eager) |
| `cms/richtext-embed-extension.ts`  | TipTap atom node (editor card + props button)                |
| `components/RichTextEditor.svelte` | Editor: insert picker + auto props form                      |
| `components/CmsContent.svelte`     | Public renderer: mounts embeds, `{@html}` for the rest       |
| `cms/sanitize.ts`                  | Write-path HTML sanitizer (allow-lists the placeholder)      |

## Security notes

- Richtext is sanitized **on write** (`sanitizeRichtextFields`, POST + PUT) with
  `xss`, and rendered with `{@html}` on read. Writes are owner/admin-gated.
- Unknown embed names render as nothing rather than breaking the page.
- The sanitizer's SVG subset is presentational only — no `script`,
  `foreignObject`, `use`, or `href`/`data:` URLs.
