/**
 * Embed manifest — metadata for every Svelte component that can be embedded
 * in CMS richtext content. Deliberately free of .svelte imports so the
 * editor extension, sanitizer tests, and import scripts can use it anywhere
 * (Workers, Vitest, browser).
 *
 * Add entries here and a matching component in ./index.ts to register a new
 * embed type for your project.
 */

export interface EmbedDefinition {
	name: string;
	label: string;
	description: string;
	defaultProps: Record<string, unknown>;
}

export const embedManifest: EmbedDefinition[] = [];

export function getEmbedDefinition(name: string): EmbedDefinition | undefined {
	return embedManifest.find((e) => e.name === name);
}
