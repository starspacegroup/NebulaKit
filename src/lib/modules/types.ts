/** One entry in the /modules gallery. Each group's `catalog.ts` exports a list of these. */
export const MODULE_GROUPS = [
	'Account',
	'Settings',
	'Marketing',
	'App shell',
	'Data & teams',
	'Commerce'
] as const;

export type ModuleGroup = (typeof MODULE_GROUPS)[number];

export interface ModuleEntry {
	/** Anchor id on the page, and the key the demo is looked up by (kebab-case, unique). */
	id: string;
	/** The export name of the component, e.g. `SignInForm`. */
	name: string;
	group: ModuleGroup;
	/** What it is for, in one or two sentences. */
	summary: string;
	/** The accessibility behaviour it promises, shown on the page. */
	a11y: string;
	/** A usage snippet. */
	code: string;
}
