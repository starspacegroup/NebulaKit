import { describe, expect, it } from 'vitest';
import { accountModules } from './catalog';
import * as account from './index';

describe('account catalog', () => {
	it('has one complete entry for every exported module', () => {
		const components = Object.keys(account).filter((k) => /^[A-Z][a-z]/.test(k));
		expect(accountModules.map((m) => m.name).sort()).toEqual(components.sort());
		for (const m of accountModules) {
			expect(m.group).toBe('Account');
			expect(m.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
			expect(m.summary.length).toBeGreaterThan(20);
			expect(m.a11y.length).toBeGreaterThan(20);
			expect(m.code).toContain(`import { ${m.name} } from`);
		}
		expect(new Set(accountModules.map((m) => m.id)).size).toBe(accountModules.length);
	});
});
