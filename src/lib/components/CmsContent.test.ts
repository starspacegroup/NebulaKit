import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The registry ships empty, so a registered embed can only be exercised by
// standing in for it. Each test sets what getEmbedComponent should resolve.
const resolve = vi.fn<(name: string) => unknown>(() => null);
vi.mock('$lib/cms/embeds', () => ({
	getEmbedComponent: (name: string) => resolve(name)
}));

import CmsContent from './CmsContent.svelte';
import TestEmbed from '../../../tests/fixtures/TestEmbed.svelte';

const placeholder = (name: string, props?: Record<string, unknown>) =>
	props
		? `<div data-svelte-embed="${name}" data-props="${JSON.stringify(props).replace(/"/g, '&quot;')}"></div>`
		: `<div data-svelte-embed="${name}"></div>`;

beforeEach(() => {
	resolve.mockReset();
	resolve.mockReturnValue(null);
});

describe('CmsContent — plain content', () => {
	it('renders stored html', () => {
		const { container } = render(CmsContent, { html: '<p>hello</p>' });
		expect(container.querySelector('p')?.textContent).toBe('hello');
	});

	it.each([
		['an empty string', ''],
		['null', null],
		['undefined', undefined]
	])('renders nothing for %s', (_label, html) => {
		const { container } = render(CmsContent, { html });
		expect(container.textContent?.trim()).toBe('');
	});

	it('keeps html on both sides of an embed in order', () => {
		resolve.mockReturnValue(TestEmbed);
		const { container } = render(CmsContent, {
			html: `<p>before</p>${placeholder('demo')}<p>after</p>`
		});

		const text = (container.textContent ?? '').replace(/\s+/g, ' ').trim();
		expect(text.indexOf('before')).toBeLessThan(text.indexOf('untitled'));
		expect(text.indexOf('untitled')).toBeLessThan(text.indexOf('after'));
	});
});

describe('CmsContent — embeds', () => {
	it('mounts the registered component for an embed placeholder', () => {
		resolve.mockReturnValue(TestEmbed);
		render(CmsContent, { html: placeholder('demo') });

		expect(screen.getByTestId('test-embed')).toBeTruthy();
		expect(resolve).toHaveBeenCalledWith('demo');
	});

	it('passes stored props through to the component', () => {
		resolve.mockReturnValue(TestEmbed);
		render(CmsContent, { html: placeholder('demo', { tone: 'warning', label: 'Heads up' }) });

		const node = screen.getByTestId('test-embed');
		expect(node.getAttribute('data-tone')).toBe('warning');
		expect(node.textContent).toBe('Heads up');
	});

	it('leaves component defaults alone when the placeholder carries no props', () => {
		resolve.mockReturnValue(TestEmbed);
		render(CmsContent, { html: placeholder('demo') });

		expect(screen.getByTestId('test-embed').getAttribute('data-tone')).toBe('neutral');
	});

	it('renders nothing for an embed with no registered component', () => {
		// The registry ships empty, so this is NebulaKit's default state and
		// must not leave a stray element or throw.
		const { container } = render(CmsContent, { html: placeholder('never-registered') });

		expect(screen.queryByTestId('test-embed')).toBeNull();
		expect(container.querySelector('[data-svelte-embed]')).toBeNull();
		expect(container.textContent?.trim()).toBe('');
	});

	it('renders the surrounding html even when the embed is unregistered', () => {
		const { container } = render(CmsContent, {
			html: `<p>kept</p>${placeholder('never-registered')}`
		});

		expect(container.querySelector('p')?.textContent).toBe('kept');
	});

	it('mounts each of several embeds', () => {
		resolve.mockReturnValue(TestEmbed);
		render(CmsContent, {
			html: `${placeholder('a', { label: 'one' })}${placeholder('b', { label: 'two' })}`
		});

		expect(screen.getAllByTestId('test-embed')).toHaveLength(2);
		expect(resolve).toHaveBeenCalledWith('a');
		expect(resolve).toHaveBeenCalledWith('b');
	});

	it('never emits the raw placeholder div into the page', () => {
		resolve.mockReturnValue(TestEmbed);
		const { container } = render(CmsContent, { html: placeholder('demo') });

		expect(container.innerHTML).not.toContain('data-svelte-embed');
	});
});
