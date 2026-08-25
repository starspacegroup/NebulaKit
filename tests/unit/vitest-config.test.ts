import { describe, expect, it } from 'vitest';
import config from '../../vite.config';

describe('Vitest configuration', () => {
	it('assigns an explicit project name for VS Code test collection', () => {
		expect(config.test?.name).toBe('unit');
	});

	it("keeps single-thread and teardown settings at Vitest's supported config levels", () => {
		const testConfig = config.test as Record<string, any>;

		expect(testConfig.pool).toBe('threads');
		expect(testConfig.fileParallelism).toBe(false);
		expect(testConfig).not.toHaveProperty('poolOptions');
		expect(testConfig.teardownTimeout).toBe(5000);
	});
});
