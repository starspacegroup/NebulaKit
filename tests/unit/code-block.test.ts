import { fireEvent, render, screen } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CodeDisclosure from '../../src/lib/components/CodeDisclosure.svelte';
import { getContrastRatio } from '../../src/lib/utils/contrast';
import CodeBlock from '../../src/lib/ui/CodeBlock.svelte';

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('CodeBlock highlighting', () => {
	it('renders tokens as spans of text and keeps the code exact', () => {
		const code = "const a = 'x'; // note\n<Button on:click={go}>Hi</Button>";
		const { container } = render(CodeBlock, { props: { code, language: 'ts' } });
		const el = container.querySelector('code')!;
		expect(el.textContent).toBe(code);
		expect(el.querySelector('.tok-keyword')?.textContent).toBe('const');
		expect(el.querySelector('.tok-string')?.textContent).toBe("'x'");
		expect(el.querySelector('.tok-comment')?.textContent).toBe('// note');
	});

	it('never turns code into markup', () => {
		const code = '<img src=x onerror="window.pwned=1"><script>window.pwned=1</script>';
		for (const language of ['svelte', 'ts', 'sh', 'css', 'json', 'yaml', 'text']) {
			const { container, unmount } = render(CodeBlock, { props: { code, language } });
			expect(container.querySelector('img')).toBeNull();
			expect(container.querySelector('script')).toBeNull();
			expect(container.querySelector('code')?.textContent).toBe(code);
			unmount();
		}
		expect((window as unknown as { pwned?: number }).pwned).toBeUndefined();
	});

	it('uses no {@html}', () => {
		const source = readFileSync(join(__dirname, '../../src/lib/ui/CodeBlock.svelte'), 'utf8');
		expect(source).not.toMatch(/\{@html/);
		expect(source).not.toMatch(/innerHTML/);
	});

	it('shows plain text for an unknown language and keeps line numbers out of the text', () => {
		const { container } = render(CodeBlock, {
			props: { code: 'a\n\nb', language: 'cobol', lineNumbers: true }
		});
		expect(container.querySelectorAll('.tok')).toHaveLength(0);
		expect(container.querySelectorAll('.code__line')).toHaveLength(3);
		expect(container.querySelector('code')?.textContent).toBe('a\n\nb');
		expect(container.querySelector('.code__pre--numbered')).toBeTruthy();
	});

	it('names the scrolling region by label, then file name, then language', () => {
		const a = render(CodeBlock, { props: { code: 'x', label: 'Button code', filename: 'f.ts' } });
		expect(screen.getByRole('region', { name: 'Button code' }).getAttribute('tabindex')).toBe('0');
		a.unmount();
		render(CodeBlock, { props: { code: 'x', language: 'sh' } });
		expect(screen.getByRole('region', { name: 'sh' })).toBeTruthy();
	});
});

describe('CodeBlock copy button', () => {
	it('copies the exact code, says Copied, then resets', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		vi.useFakeTimers();
		const code = 'line one\n  <b>"quoted"</b>\n\ttab';
		render(CodeBlock, { props: { code, language: 'svelte' } });
		const button = screen.getByRole('button', { name: 'Copy code' });
		await fireEvent.click(button);
		await vi.advanceTimersByTimeAsync(0);
		expect(writeText).toHaveBeenCalledTimes(1);
		expect(writeText).toHaveBeenCalledWith(code);
		expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
		expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('Copied to clipboard');
		await vi.advanceTimersByTimeAsync(2000);
		expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
		expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('');
	});
});

describe('CodeDisclosure', () => {
	it('is a native details with a Code summary around a labelled CodeBlock', () => {
		const { container } = render(CodeDisclosure, { props: { name: 'Thing', code: '<Thing />' } });
		const details = container.querySelector('details')!;
		expect(details.open).toBe(false);
		expect(details.querySelector('summary')?.textContent?.trim()).toBe('Code');
		expect(screen.getByRole('region', { name: 'Thing code' }).textContent).toBe('<Thing />');
		details.open = true;
		expect(details.open).toBe(true);
	});
});

describe('syntax colour tokens', () => {
	const css = readFileSync(join(__dirname, '../../src/app.css'), 'utf8');
	const block = (re: RegExp) => css.match(re)![1];
	const read = (b: string) =>
		Object.fromEntries(
			[...b.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]])
		);
	const themes = {
		light: read(block(/:root\s*\{([\s\S]*?)\n\}/)),
		dark: read(block(/\[data-theme=['"]dark['"]\]\s*\{([\s\S]*?)\n\}/))
	};
	const names = [
		'keyword',
		'string',
		'comment',
		'number',
		'tag',
		'attr',
		'function',
		'variable',
		'punct'
	];

	for (const [theme, vars] of Object.entries(themes)) {
		it(`every --code-* colour has 4.5:1 on the block ground in the ${theme} theme`, () => {
			for (const name of names) {
				const value = vars[`code-${name}`];
				expect(value, `--code-${name}`).toBeTruthy();
				expect(getContrastRatio(value, vars['color-surface'])).toBeGreaterThanOrEqual(4.5);
			}
		});
	}

	it('the component styles every token kind the tokenizer emits', () => {
		const source = readFileSync(join(__dirname, '../../src/lib/ui/CodeBlock.svelte'), 'utf8');
		for (const name of names) expect(source).toContain(`.tok-${name}`);
	});
});
