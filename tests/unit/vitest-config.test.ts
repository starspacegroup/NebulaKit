import { describe, expect, it } from 'vitest';
import config from '../../vite.config';

describe('Vitest configuration', () => {
	it('assigns an explicit project name for VS Code test collection', () => {
		expect(config.test?.name).toBe('unit');
	});
});
