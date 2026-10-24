import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import TrustBadges from './TrustBadges.svelte';

const now = new Date('2026-10-24T12:00:00Z');
const good = {
	label: 'Mozilla Observatory A+',
	reportUrl: 'https://developer.mozilla.org/en-US/observatory/analyze?host=example.com',
	measuredOn: '2026-10-22',
	passed: true
};

describe('TrustBadges', () => {
	it('links each shown badge to its report with the measured date', () => {
		const { getByText, container } = render(TrustBadges, {
			props: { checks: [good, { ...good, label: 'Failing', passed: false }], now }
		});
		const link = container.querySelector('a');
		expect(link?.getAttribute('href')).toBe(good.reportUrl);
		expect(link?.getAttribute('rel')).toContain('noopener');
		expect(getByText('2026-10-22').getAttribute('datetime')).toBe('2026-10-22');
		expect(container.querySelectorAll('li')).toHaveLength(1);
	});

	it('renders nothing when no check may be shown', () => {
		const { container } = render(TrustBadges, {
			props: { checks: [{ ...good, passed: false }], now }
		});
		expect(container.querySelector('section')).toBeNull();
	});
});
