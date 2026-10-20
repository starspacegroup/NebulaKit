<script lang="ts">
	/**
	 * The settings for the selected block. The controls come from the block's
	 * `fields` in the library table, so a new block type needs no editor code.
	 * A link or image address is only committed once it is one the page may hold
	 * (a path, http(s) or mailto) — until then the author sees why, in words.
	 */
	import {
		BLOCK_LIBRARY,
		BREAKPOINTS,
		MAX_COLUMNS,
		safeHref,
		safeImageSrc,
		type Block,
		type Breakpoint
	} from './schema';
	import type { LintIssue } from './lint';

	let {
		block,
		issues = [],
		onfield,
		onhide,
		oncolumns
	}: {
		block: Block;
		issues?: LintIssue[];
		onfield: (key: string, value: unknown) => void;
		onhide: (hide: Breakpoint[]) => void;
		oncolumns: (count: number) => void;
	} = $props();

	const spec = $derived(BLOCK_LIBRARY[block.type]);
	const values = $derived(block.props as Record<string, unknown>);

	/** What the author has typed in a validated field but the page cannot hold yet. */
	let drafts = $state<Record<string, string>>({});
	$effect(() => {
		void block.id;
		drafts = {};
	});

	function commitText(key: string, kind: 'link' | 'image', value: string) {
		drafts[key] = value;
		const ok = kind === 'link' ? safeHref(value) : safeImageSrc(value);
		if (ok !== null) onfield(key, ok);
	}

	const invalid = (key: string, kind: 'link' | 'image') => {
		const value = drafts[key];
		if (value === undefined) return false;
		return (kind === 'link' ? safeHref(value) : safeImageSrc(value)) === null;
	};

	const hidden = $derived(block.hide ?? []);
	function toggleHide(point: Breakpoint, on: boolean) {
		onhide(BREAKPOINTS.filter((b) => (b === point ? on : hidden.includes(b))));
	}
	const id = (key: string) => `ins-${block.id}-${key}`;
</script>

<div class="ins">
	<h2 id="pe-inspector-title" tabindex="-1">{spec.label} settings</h2>
	<p class="ins__help">{spec.description}</p>

	{#each spec.fields as field (field.key)}
		<div class="ins__field">
			<label for={id(field.key)}>{field.label}</label>
			{#if field.kind === 'text'}
				<input
					id={id(field.key)}
					value={String(values[field.key] ?? '')}
					maxlength={field.max}
					required={field.required}
					oninput={(e) => onfield(field.key, e.currentTarget.value)}
				/>
			{:else if field.kind === 'textarea'}
				<textarea
					id={id(field.key)}
					rows="5"
					value={String(values[field.key] ?? '')}
					maxlength={field.max}
					oninput={(e) => onfield(field.key, e.currentTarget.value)}></textarea>
			{:else if field.kind === 'link' || field.kind === 'image'}
				<input
					id={id(field.key)}
					inputmode="url"
					autocomplete="off"
					value={drafts[field.key] ?? String(values[field.key] ?? '')}
					aria-invalid={invalid(field.key, field.kind)}
					aria-describedby={invalid(field.key, field.kind) ? `${id(field.key)}-error` : undefined}
					oninput={(e) => commitText(field.key, field.kind, e.currentTarget.value)}
				/>
				{#if invalid(field.key, field.kind)}
					<p class="ins__error" id="{id(field.key)}-error">
						Use a path such as /about, an https:// address{field.kind === 'link'
							? ', or mailto:'
							: ''}. The page keeps the last good value until this one is valid.
					</p>
				{/if}
			{:else if field.kind === 'number'}
				<input
					id={id(field.key)}
					type="number"
					min={field.min}
					max={field.max}
					value={Number(values[field.key])}
					oninput={(e) => {
						const n = e.currentTarget.valueAsNumber;
						if (Number.isInteger(n) && n >= field.min && n <= field.max) onfield(field.key, n);
					}}
				/>
			{:else if field.kind === 'select'}
				<select
					id={id(field.key)}
					value={String(values[field.key])}
					onchange={(e) => {
						const picked = field.options.find((o) => String(o.value) === e.currentTarget.value);
						if (picked) onfield(field.key, picked.value);
					}}
				>
					{#each field.options as option (option.value)}
						<option value={String(option.value)}>{option.label}</option>
					{/each}
				</select>
			{/if}
		</div>
	{/each}

	{#if block.type === 'columns'}
		<div class="ins__field">
			<label for={id('count')}>Number of columns</label>
			<select
				id={id('count')}
				value={String(block.children?.length ?? 1)}
				onchange={(e) => oncolumns(Number(e.currentTarget.value))}
			>
				{#each Array.from({ length: MAX_COLUMNS }, (_, i) => i + 1) as n (n)}
					<option value={String(n)}>{n}</option>
				{/each}
			</select>
			<p class="ins__note">Fewer columns move their blocks into the last one. Nothing is lost.</p>
		</div>
	{/if}

	{#if block.type !== 'column'}
		<fieldset class="ins__field">
			<legend>Hide on</legend>
			{#each BREAKPOINTS as point (point)}
				<label class="ins__check">
					<input
						type="checkbox"
						checked={hidden.includes(point)}
						onchange={(e) => toggleHide(point, e.currentTarget.checked)}
					/>
					{point[0].toUpperCase() + point.slice(1)}
				</label>
			{/each}
		</fieldset>
	{/if}

	{#if issues.length}
		<div class="ins__issues" role="group" aria-label="Things to fix on this block">
			<h3>To fix</h3>
			<ul>
				{#each issues as issue (issue.rule)}
					<li>{issue.message}</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	.ins {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	h2 {
		margin: 0;
		font-size: 1rem;
	}
	h2:focus {
		outline: none;
	}
	h2:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
	h3 {
		margin: 0 0 0.25rem;
		font-size: 0.875rem;
	}
	.ins__help,
	.ins__note {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}
	.ins__field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	label,
	legend {
		padding: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}
	input:not([type='checkbox']),
	select,
	textarea {
		box-sizing: border-box;
		width: 100%;
		min-height: 2.75rem;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
	}
	input:focus-visible,
	select:focus-visible,
	textarea:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}
	input[aria-invalid='true'] {
		border-color: var(--color-error);
	}
	.ins__error {
		margin: 0;
		color: var(--color-error);
		font-size: 0.8125rem;
	}
	.ins__check {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		font-weight: 400;
	}
	.ins__check input {
		inline-size: 1.5rem;
		block-size: 1.5rem;
	}
	.ins__issues {
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.ins__issues ul {
		margin: 0;
		padding-inline-start: 1.25rem;
		font-size: 0.875rem;
	}
</style>
