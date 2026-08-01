# CMS Svelte Embeds

Live Svelte components inside CMS richtext. An author drops an embed into the
editor; the page renders the real component, with props, not a snapshot of its
markup.

The registry ships **empty** — the kit gives you the mechanism, not someone
else's widgets.

---

## How an embed is stored

Embeds live in the stored HTML as atom placeholder blocks:

```html
<div data-svelte-embed="callout" data-props='{"tone":"warning"}'></div>
```

The name is restricted to `[a-z0-9-]+`. Props are JSON, entity-escaped so they
survive inside a double-quoted attribute. `src/lib/cms/embed.ts` is the single
codec for that format — building placeholders and parsing them back — and it is
pure string logic, so it runs in Workers, Vitest, and the browser alike.

Malformed props degrade to `{}` rather than throwing. A half-broken attribute
should cost you the props, not the page.

---

## The three parts

| Part          | File                                   | Job                                          |
| ------------- | -------------------------------------- | -------------------------------------------- |
| Manifest      | `src/lib/cms/embeds/manifest.ts`       | Metadata: name, label, description, defaults |
| Component map | `src/lib/cms/embeds/index.ts`          | Maps a name to its Svelte component          |
| Renderer      | `src/lib/components/CmsContent.svelte` | Turns stored HTML into live components       |

The manifest is deliberately free of `.svelte` imports. That is what lets the
editor extension, tests, and any import script read embed metadata from
anywhere — including a Workers context that cannot compile a component.

---

## Adding an embed

1. **Build the component.** Its exported props are the embed's props.

   ```svelte
   <!-- src/lib/components/embeds/Callout.svelte -->
   <script lang="ts">
   	export let tone: 'info' | 'warning' = 'info';
   	export let title = '';
   </script>

   <aside class="callout callout--{tone}">
   	{#if title}<strong>{title}</strong>{/if}
   	<slot />
   </aside>
   ```

2. **Declare it in the manifest.** `defaultProps` is what the editor inserts.

   ```ts
   export const embedManifest: EmbedDefinition[] = [
   	{
   		name: 'callout',
   		label: 'Callout',
   		description: 'A highlighted aside',
   		defaultProps: { tone: 'info', title: '' }
   	}
   ];
   ```

3. **Register the component.**

   ```ts
   import Callout from '$lib/components/embeds/Callout.svelte';

   const embedComponents: Record<string, ComponentType<SvelteComponent>> = {
   	callout: Callout
   };
   ```

That is the whole registration. No container is edited to add an embed — the
same property the CMS embed system and the component library both rely on.

The two entries must stay in step: a manifest entry with no component is
insertable in the editor and invisible on the page.
`tests/unit/cms-embeds-registry.test.ts` asserts exactly that, so a half-added
embed fails the suite rather than shipping.

---

## Rendering

**Every richtext surface must render through `CmsContent`, never a bare
`{@html}`.** A plain `{@html}` emits the placeholder `<div>` verbatim and the
component never mounts — the embed silently disappears, which is how this went
unnoticed before.

```svelte
<script lang="ts">
	import CmsContent from '$lib/components/CmsContent.svelte';
</script>

<div class="cms-content">
	<CmsContent html={String(item.fields.body ?? '')} />
</div>
```

`CmsContent` splits the stored HTML into plain runs and embed segments,
injecting the former with `{@html}` and mounting the latter through the
registry.

An embed whose component is not registered **renders nothing**. Since the
registry ships empty, unregistered is the default state of a fresh template
rather than an error worth showing a visitor. The surrounding content still
renders.

---

## Editing

`src/lib/cms/richtext-embed-extension.ts` is the TipTap node. It reads
`getEmbedDefinition(name)` for the label shown in the editor, so an embed with a
manifest entry appears in the insert menu automatically.

---

## Security note

`CmsContent` renders the non-embed parts of stored content with `{@html}`, and
**the kit currently ships no HTML sanitizer on the write path**. Richtext is
therefore stored and rendered as authored.

That is acceptable only while richtext authoring is restricted to trusted admins,
which is the template's default. Before you widen authoring to a less-trusted
role, add write-path sanitization — and make sure whatever allowlist you choose
preserves `data-svelte-embed` and `data-props`, or you will strip every embed on
save.
