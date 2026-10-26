/**
 * The /modules gallery: every composed module in `$lib/modules`, with what it
 * is for and how to use it. `catalog.test.ts` fails when a module component
 * exists without an entry here, or an entry has no component.
 */
import { accountModules } from './account/catalog';
import { commerceModules } from './commerce/catalog';
import { dataModules } from './data/catalog';
import { marketingModules } from './marketing/catalog';
import { settingsModules } from './settings/catalog';
import { shellModules } from './shell/catalog';
import { MODULE_GROUPS, type ModuleEntry } from './types';

export { MODULE_GROUPS };
export type { ModuleEntry, ModuleGroup } from './types';

export const moduleCatalog: ModuleEntry[] = [
	...accountModules,
	...settingsModules,
	...marketingModules,
	...shellModules,
	...dataModules,
	...commerceModules
];

export function moduleEntry(id: string): ModuleEntry {
	const entry = moduleCatalog.find((e) => e.id === id);
	if (!entry) throw new Error(`No module entry "${id}"`);
	return entry;
}
