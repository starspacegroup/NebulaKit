<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const blank = {
		name: '',
		slug: '',
		description: '',
		price: '',
		currency: 'usd',
		imageUrl: '',
		type: 'physical',
		printfulVariantId: '',
		active: true
	};
	const createValues = $derived(
		form && 'values' in form && form.values && form.action === 'create' ? form.values : blank
	);
	/** A rejected edit, shown back as typed on the product it belongs to. */
	const rejected = $derived(
		form && 'values' in form && 'id' in form && form.values && form.action === 'update'
			? form
			: null
	);
</script>

<svelte:head><title>Products</title></svelte:head>

<section class="products">
	<h1>Products</h1>
	<p>
		What the shop sells. Archive a product to hide it from the shop without losing it or any order
		that names it. Prices are in the product's currency, in dollars and cents.
	</p>

	<div role="status" aria-live="polite">
		{#if form?.message}<p class="ok">{form.message}</p>{/if}
		{#if form?.problems}
			<ul class="error" role="alert">
				{#each form.problems as problem (problem)}<li>{problem}</li>{/each}
			</ul>
		{/if}
	</div>

	<form method="POST" action="?/create" use:enhance class="card" aria-labelledby="add-heading">
		<h2 id="add-heading">Add a product</h2>
		<div class="fields">
			<label>
				Name
				<input name="name" required maxlength="200" value={createValues.name} />
			</label>
			<label>
				Slug
				<input
					name="slug"
					required
					maxlength="80"
					pattern="[a-z0-9][a-z0-9\-]*"
					placeholder="blue-mug"
					value={createValues.slug}
				/>
			</label>
			<label>
				Price
				<input
					name="price"
					required
					inputmode="decimal"
					placeholder="12.50"
					value={createValues.price}
				/>
			</label>
			<label>
				Currency
				<input name="currency" required maxlength="3" value={createValues.currency} />
			</label>
			<label>
				Type
				<select name="type">
					<option value="physical" selected={createValues.type === 'physical'}>Physical</option>
					<option value="digital" selected={createValues.type === 'digital'}>Digital</option>
				</select>
			</label>
			<label>
				Image address
				<input name="image_url" type="url" placeholder="https://" value={createValues.imageUrl} />
			</label>
			<label>
				Printful variant id
				<input
					name="printful_variant_id"
					inputmode="numeric"
					value={createValues.printfulVariantId}
				/>
			</label>
			<label class="wide">
				Description
				<textarea name="description" rows="3" maxlength="5000">{createValues.description}</textarea>
			</label>
		</div>
		<label class="check"
			><input type="checkbox" name="active" checked={createValues.active} /> Show in the shop</label
		>
		<button type="submit">Add product</button>
	</form>

	{#if data.products.length === 0}
		<p>No products yet.</p>
	{:else}
		<ul class="list" aria-label="Products">
			{#each data.products as product (product.id)}
				{@const v = rejected && rejected.id === product.id ? rejected.values : product.values}
				<li class:archived={!product.active}>
					<form method="POST" action="?/update" use:enhance class="edit">
						<input type="hidden" name="id" value={product.id} />
						<h3>
							{product.values.name}
							<span class="price">{product.price}</span>
							{#if !product.active}<span class="badge">Archived</span>{/if}
						</h3>
						<div class="fields">
							<label>
								Name
								<input name="name" required maxlength="200" value={v.name} />
							</label>
							<label>
								Slug
								<input
									name="slug"
									required
									maxlength="80"
									pattern="[a-z0-9][a-z0-9\-]*"
									value={v.slug}
								/>
							</label>
							<label>
								Price
								<input name="price" required inputmode="decimal" value={v.price} />
							</label>
							<label>
								Currency
								<input name="currency" required maxlength="3" value={v.currency} />
							</label>
							<label>
								Type
								<select name="type">
									<option value="physical" selected={v.type === 'physical'}>Physical</option>
									<option value="digital" selected={v.type === 'digital'}>Digital</option>
								</select>
							</label>
							<label>
								Image address
								<input name="image_url" type="url" value={v.imageUrl} />
							</label>
							<label>
								Printful variant id
								<input name="printful_variant_id" inputmode="numeric" value={v.printfulVariantId} />
							</label>
							<label class="wide">
								Description
								<textarea name="description" rows="3" maxlength="5000">{v.description}</textarea>
							</label>
						</div>
						<input
							type="hidden"
							name="active"
							value={product.active ? 'on' : ''}
							disabled={!product.active}
						/>
						<div class="actions">
							<button type="submit">Save</button>
							{#if product.active}
								<button
									type="submit"
									formaction="?/archive"
									class="secondary"
									aria-label="Archive {product.values.name}">Archive</button
								>
							{:else}
								<button
									type="submit"
									formaction="?/restore"
									class="secondary"
									aria-label="Restore {product.values.name}">Restore</button
								>
								<button
									type="submit"
									formaction="?/delete"
									class="danger"
									aria-label="Delete {product.values.name}">Delete</button
								>
							{/if}
						</div>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.products {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: var(--color-text);
	}
	p {
		color: var(--color-text-secondary);
	}
	.card,
	.list li {
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.card,
	.edit {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	h2,
	h3 {
		margin: 0;
		font-size: 1.1rem;
	}
	.price {
		margin-left: 0.5rem;
		color: var(--color-text-secondary);
		font-weight: 400;
	}
	.badge {
		margin-left: 0.5rem;
		padding: 0.1rem 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		font-weight: 500;
	}
	.fields {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}
	@media (min-width: 40rem) {
		.fields {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (min-width: 64rem) {
		.fields {
			grid-template-columns: repeat(4, 1fr);
		}
	}
	.wide {
		grid-column: 1 / -1;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	label.check {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
	}
	input,
	select,
	textarea {
		min-height: 2.75rem;
		padding: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
	}
	input[type='checkbox'] {
		min-height: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	button {
		min-height: 2.75rem;
		padding: 0 1rem;
		border: 0;
		border-radius: var(--radius-md);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		font: inherit;
		cursor: pointer;
	}
	button.secondary {
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text);
	}
	button.danger {
		background: var(--color-danger-solid);
		color: var(--color-on-solid);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.list li.archived {
		opacity: 0.8;
	}
	.ok {
		color: var(--color-success);
	}
	.error {
		margin: 0;
		padding-left: 1.25rem;
		color: var(--color-error);
	}
</style>
