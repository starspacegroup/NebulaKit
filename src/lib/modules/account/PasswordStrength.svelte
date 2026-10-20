<!--
	PasswordStrength — a live strength meter and a checklist of requirements for
	the password being typed. Strength is a word as well as a bar, so it never
	rests on colour; each requirement says "met" or "not met" in text. Point a
	password field's `aria-describedby` at the `id` so the requirements are read
	with the field. The strength word is announced politely when it changes.
-->
<script lang="ts">
	import { uid } from '$lib/ui';
	import {
		defaultPasswordRules,
		passwordRequirements,
		passwordStrength,
		type PasswordRule,
		type StrengthLevel
	} from './logic';

	export let password = '';
	export let id: string = uid('password-strength');
	export let rules: PasswordRule[] = defaultPasswordRules();
	export let label = 'Password strength';
	export let checklistLabel = 'Your password needs:';
	export let metText = 'met';
	export let unmetText = 'not met';
	export let levels: Record<StrengthLevel, string> = {
		empty: 'Not entered yet',
		weak: 'Weak',
		fair: 'Fair',
		good: 'Good',
		strong: 'Strong'
	};
	/** Hide the checklist and show the meter only. */
	export let showChecklist = true;

	$: strength = passwordStrength(password);
	$: requirements = passwordRequirements(password, rules);
</script>

<div class="strength" {id}>
	<div class="strength__head">
		<span>{label}:</span>
		<strong class="strength__word strength__word--{strength.level}" role="status">
			{levels[strength.level]}
		</strong>
	</div>
	<div class="strength__track" aria-hidden="true">
		<div
			class="strength__fill strength__fill--{strength.level}"
			style:inline-size="{strength.percent}%"
		></div>
	</div>
	{#if showChecklist}
		<p class="strength__intro">{checklistLabel}</p>
		<ul class="strength__list">
			{#each requirements as req (req.id)}
				<li class:met={req.met}>
					<span class="mark" aria-hidden="true">{req.met ? '✓' : '○'}</span>
					<span>{req.label}</span>
					<span class="sr-only">({req.met ? metText : unmetText})</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.strength {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		min-width: 0;
		font-size: 0.875rem;
	}

	.strength__head {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
		color: var(--color-text-secondary);
	}

	.strength__word {
		color: var(--color-text);
	}

	.strength__track {
		block-size: 0.5rem;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
	}

	.strength__fill {
		block-size: 100%;
		background: var(--color-text-secondary);
		transition: inline-size var(--transition-base);
	}

	.strength__fill--weak {
		background: var(--color-danger);
	}

	.strength__fill--fair {
		background: var(--color-warning);
	}

	.strength__fill--good {
		background: var(--color-primary-solid);
	}

	.strength__fill--strong {
		background: var(--color-success);
	}

	.strength__intro {
		margin: var(--spacing-xs) 0 0;
		color: var(--color-text-secondary);
	}

	.strength__list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		gap: var(--spacing-sm);
		color: var(--color-text-secondary);
	}

	li.met {
		color: var(--color-text);
	}

	.mark {
		inline-size: 1rem;
		text-align: center;
	}

	li.met .mark {
		color: var(--color-success);
		font-weight: 700;
	}

	@media (prefers-reduced-motion: reduce) {
		.strength__fill {
			transition: none;
		}
	}

	@media (forced-colors: active) {
		.strength__fill {
			background: Highlight;
		}
	}
</style>
