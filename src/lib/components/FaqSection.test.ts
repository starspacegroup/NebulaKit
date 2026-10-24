import { render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import FaqSection from './FaqSection.svelte';

const items = [
	{ question: 'Is the check free?', answer: 'Yes. The check costs nothing.' },
	{ question: '', answer: 'dropped' }
];

describe('FaqSection', () => {
	beforeEach(() => {
		document.head.querySelectorAll('script[type="application/ld+json"]').forEach((e) => e.remove());
	});

	it('renders visible text and matching JSON-LD from the same items', () => {
		const { getByText, queryByText } = render(FaqSection, { props: { items } });
		expect(getByText('Is the check free?')).toBeTruthy();
		expect(queryByText('dropped')).toBeNull();
		const tag = document.head.querySelector('script[type="application/ld+json"]');
		const ld = JSON.parse(tag?.textContent ?? '{}');
		expect(ld.mainEntity).toHaveLength(1);
		expect(ld.mainEntity[0].name).toBe('Is the check free?');
		expect(ld.mainEntity[0].acceptedAnswer.text).toBe('Yes. The check costs nothing.');
	});

	it('can skip structured data, and renders nothing for an empty list', () => {
		render(FaqSection, { props: { items, structuredData: false } });
		expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
		const { container } = render(FaqSection, { props: { items: [] } });
		expect(container.querySelector('section')).toBeNull();
	});
});
