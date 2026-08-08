/**
 * Embed manifest — metadata for every Svelte component that can be embedded in
 * CMS richtext content.
 *
 * Registration is one step: drop a folder under `embeds/<name>/` containing a
 * `definition.ts` (which exports `definition = defineEmbed({...})`) and one
 * `.svelte` component. Both are auto-discovered — this file globs the
 * definitions, `index.ts` globs the components. No central list to keep in sync.
 *
 * This module stays free of `.svelte` imports so the editor extension,
 * sanitizer, and tooling can read embed metadata anywhere (Workers, Vitest,
 * browser).
 */

import type { EmbedDefinition } from './props-schema';

export type {
	EmbedDefinition,
	EmbedPropField,
	EmbedPropType,
	EmbedPropsSchema,
	EmbedSelectOption
} from './props-schema';

// Eagerly discover every embed definition. `import.meta.glob` is resolved by
// Vite at build time, so this works in the Workers bundle too.
const definitionModules = import.meta.glob('./*/definition.ts', { eager: true });

export const embedManifest: EmbedDefinition[] = Object.values(definitionModules)
	.map((mod) => (mod as { definition?: EmbedDefinition }).definition)
	.filter((def): def is EmbedDefinition => Boolean(def && def.name))
	.sort((a, b) => a.name.localeCompare(b.name));

export function getEmbedDefinition(name: string): EmbedDefinition | undefined {
	return embedManifest.find((entry) => entry.name === name);
}
