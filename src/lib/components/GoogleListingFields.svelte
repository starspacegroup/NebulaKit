<script lang="ts">
	import { BLANK_GOOGLE_VALUES, type GoogleFormValues } from '$lib/shop/google-form';

	/** The "Google listing" section of the product form (docs/GOOGLE_LISTINGS.md). */
	let { values: given, open = false }: { values?: GoogleFormValues; open?: boolean } = $props();
	// A form value set from before these fields existed reads as all blank.
	const values = $derived(given ?? BLANK_GOOGLE_VALUES);
</script>

<details class="google" {open}>
	<summary>Google listing</summary>
	<p class="hint">
		What Google Merchant Center asks for. Everything here is optional; the health page lists what
		Google would still reject. Dates and times are UTC.
	</p>

	<fieldset>
		<legend>Identity</legend>
		<div class="fields">
			<label>
				Brand
				<input name="g_brand" maxlength="70" value={values.brand} />
			</label>
			<label>
				GTIN (barcode)
				<input
					name="g_gtin"
					inputmode="numeric"
					pattern={'(\\d{8}|\\d{12,14})'}
					placeholder="8, 12, 13 or 14 digits"
					value={values.gtin}
				/>
			</label>
			<label>
				MPN
				<input name="g_mpn" maxlength="70" value={values.mpn} />
			</label>
			<label>
				Identifiers exist
				<select name="g_identifierExists">
					<option value="" selected={values.identifierExists === ''}>Not stated</option>
					<option value="yes" selected={values.identifierExists === 'yes'}>Yes</option>
					<option value="no" selected={values.identifierExists === 'no'}>No, it has none</option>
				</select>
			</label>
			<label>
				Condition
				<select name="g_condition">
					<option value="" selected={values.condition === ''}>New (default)</option>
					<option value="refurbished" selected={values.condition === 'refurbished'}
						>Refurbished</option
					>
					<option value="used" selected={values.condition === 'used'}>Used</option>
					<option value="new" selected={values.condition === 'new'}>New</option>
				</select>
			</label>
			<label>
				Item group id (variants)
				<input name="g_itemGroupId" maxlength="50" value={values.itemGroupId} />
			</label>
		</div>
	</fieldset>

	<fieldset>
		<legend>Category</legend>
		<div class="fields">
			<label class="wide">
				Google product category (id or full path)
				<input
					name="g_googleProductCategory"
					placeholder="1604 or Apparel &amp; Accessories &gt; Clothing"
					value={values.googleProductCategory}
				/>
			</label>
			<label class="wide">
				Product type (your own category path)
				<input name="g_productType" maxlength="750" value={values.productType} />
			</label>
		</div>
	</fieldset>

	<fieldset>
		<legend>Availability and sale</legend>
		<div class="fields">
			<label>
				Availability
				<select name="g_availability">
					<option value="" selected={values.availability === ''}>In stock (default)</option>
					<option value="out_of_stock" selected={values.availability === 'out_of_stock'}
						>Out of stock</option
					>
					<option value="preorder" selected={values.availability === 'preorder'}>Preorder</option>
					<option value="backorder" selected={values.availability === 'backorder'}>Backorder</option
					>
				</select>
			</label>
			<label>
				Available from (preorder/backorder), UTC
				<input name="g_availabilityDate" placeholder="2026-12-01" value={values.availabilityDate} />
			</label>
			<label>
				Sale price
				<input name="g_salePrice" inputmode="decimal" placeholder="9.99" value={values.salePrice} />
			</label>
			<label>
				Sale starts (UTC)
				<input name="g_saleStartsAt" type="datetime-local" value={values.saleStartsAt} />
			</label>
			<label>
				Sale ends (UTC)
				<input name="g_saleEndsAt" type="datetime-local" value={values.saleEndsAt} />
			</label>
		</div>
		<p class="hint">
			A sale price is charged at checkout while the sale runs, not just advertised. Set both dates
			or neither.
		</p>
	</fieldset>

	<fieldset>
		<legend>Images</legend>
		<label class="wide">
			Additional images (one https address per line, up to 10)
			<textarea name="g_additionalImages" rows="3">{values.additionalImages}</textarea>
		</label>
	</fieldset>

	<fieldset>
		<legend>Apparel and variants</legend>
		<div class="fields">
			<label>
				Color
				<input name="g_color" maxlength="100" value={values.color} />
			</label>
			<label>
				Size
				<input name="g_size" maxlength="100" value={values.size} />
			</label>
			<label>
				Material
				<input name="g_material" maxlength="200" value={values.material} />
			</label>
			<label>
				Gender
				<select name="g_gender">
					<option value="" selected={values.gender === ''}>Not stated</option>
					<option value="male" selected={values.gender === 'male'}>Male</option>
					<option value="female" selected={values.gender === 'female'}>Female</option>
					<option value="unisex" selected={values.gender === 'unisex'}>Unisex</option>
				</select>
			</label>
			<label>
				Age group
				<select name="g_ageGroup">
					<option value="" selected={values.ageGroup === ''}>Not stated</option>
					<option value="newborn" selected={values.ageGroup === 'newborn'}>Newborn</option>
					<option value="infant" selected={values.ageGroup === 'infant'}>Infant</option>
					<option value="toddler" selected={values.ageGroup === 'toddler'}>Toddler</option>
					<option value="kids" selected={values.ageGroup === 'kids'}>Kids</option>
					<option value="adult" selected={values.ageGroup === 'adult'}>Adult</option>
				</select>
			</label>
		</div>
	</fieldset>

	<fieldset>
		<legend>Shipping size</legend>
		<div class="fields">
			<label>
				Weight (grams)
				<input name="g_weightGrams" inputmode="numeric" value={values.weightGrams} />
			</label>
			<label>
				Length (cm)
				<input name="g_lengthCm" inputmode="decimal" value={values.lengthCm} />
			</label>
			<label>
				Width (cm)
				<input name="g_widthCm" inputmode="decimal" value={values.widthCm} />
			</label>
			<label>
				Height (cm)
				<input name="g_heightCm" inputmode="decimal" value={values.heightCm} />
			</label>
		</div>
	</fieldset>

	<fieldset>
		<legend>Custom labels</legend>
		<div class="fields">
			<label>
				Label 0
				<input name="g_customLabel0" maxlength="100" value={values.customLabel0} />
			</label>
			<label>
				Label 1
				<input name="g_customLabel1" maxlength="100" value={values.customLabel1} />
			</label>
			<label>
				Label 2
				<input name="g_customLabel2" maxlength="100" value={values.customLabel2} />
			</label>
			<label>
				Label 3
				<input name="g_customLabel3" maxlength="100" value={values.customLabel3} />
			</label>
			<label>
				Label 4
				<input name="g_customLabel4" maxlength="100" value={values.customLabel4} />
			</label>
		</div>
	</fieldset>

	<div class="checks">
		<label class="check"
			><input type="checkbox" name="g_adult" checked={values.adult} /> Adult content</label
		>
		<label class="check"
			><input type="checkbox" name="g_excluded" checked={values.excluded} /> Keep out of the Google feed</label
		>
	</div>
</details>

<style>
	.google {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 0.5rem 0.75rem;
		background: var(--color-background);
		color: var(--color-text);
	}
	summary {
		min-height: 2.75rem;
		display: flex;
		align-items: center;
		cursor: pointer;
		font-weight: 600;
	}
	.hint {
		margin: 0.25rem 0 0.75rem;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}
	fieldset {
		margin: 0 0 0.75rem;
		padding: 0.5rem 0.75rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}
	legend {
		padding: 0 0.25rem;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
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
	.checks {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
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
</style>
