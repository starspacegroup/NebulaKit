<script lang="ts">
	export let value: { text: string; done: boolean }[] = [];

	let newTaskText = '';

	// Normalize on mount — handles legacy string[] format
	$: if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
		value = (value as unknown as string[]).map((t) => ({ text: t, done: false }));
	}

	function addTask() {
		const trimmed = newTaskText.trim();
		if (!trimmed) return;
		value = [...value, { text: trimmed, done: false }];
		newTaskText = '';
	}

	function removeTask(i: number) {
		value = value.filter((_, idx) => idx !== i);
	}

	function toggleDone(i: number) {
		value = value.map((t, idx) => (idx === i ? { ...t, done: !t.done } : t));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addTask();
		}
	}
</script>

<div class="tasklist">
	{#if value.length > 0}
		<ul class="task-items" role="list">
			{#each value as task, i}
				<li class="task-item" class:task-done={task.done}>
					<label class="task-check">
						<input
							type="checkbox"
							checked={task.done}
							on:change={() => toggleDone(i)}
							aria-label="Mark task done"
						/>
					</label>
					<span class="task-text">{task.text}</span>
					<button
						type="button"
						class="task-remove"
						on:click={() => removeTask(i)}
						aria-label="Remove task"
						title="Remove"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="task-empty">No tasks yet. Add one below.</p>
	{/if}

	<div class="task-add-row">
		<input
			type="text"
			bind:value={newTaskText}
			placeholder="New task..."
			on:keydown={handleKeydown}
			class="task-input"
		/>
		<button type="button" class="task-add-btn" on:click={addTask}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			Add
		</button>
	</div>

	<p class="task-summary">
		{value.filter((t) => t.done).length}/{value.length} done
	</p>
</div>

<style>
	.tasklist {
		width: 100%;
	}

	.task-items {
		list-style: none;
		padding: 0;
		margin: 0 0 var(--spacing-sm) 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.task-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: 0.375rem var(--spacing-sm);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		transition: background 0.1s;
	}

	.task-item:hover {
		border-color: var(--color-primary);
	}

	.task-check input[type='checkbox'] {
		width: 15px;
		height: 15px;
		accent-color: var(--color-primary);
		cursor: pointer;
		flex-shrink: 0;
	}

	.task-text {
		flex: 1;
		font-size: 0.875rem;
		color: var(--color-text);
		word-break: break-word;
	}

	.task-done .task-text {
		text-decoration: line-through;
		color: var(--color-text-secondary);
		opacity: 0.7;
	}

	.task-remove {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--color-text-secondary);
		border-radius: var(--radius-sm);
		cursor: pointer;
		flex-shrink: 0;
		transition: color 0.15s, background 0.15s;
	}

	.task-remove:hover {
		color: var(--color-danger, #dc3545);
		background: color-mix(in srgb, var(--color-danger, #dc3545) 10%, transparent);
	}

	.task-empty {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		margin: 0 0 var(--spacing-sm) 0;
		padding: var(--spacing-sm);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-sm);
		text-align: center;
	}

	.task-add-row {
		display: flex;
		gap: var(--spacing-xs);
	}

	.task-input {
		flex: 1;
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-family: inherit;
	}

	.task-input:focus {
		border-color: var(--color-primary);
		outline: none;
	}

	.task-input::placeholder {
		color: var(--color-text-secondary);
	}

	.task-add-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--color-primary);
		color: var(--color-background);
		border: none;
		border-radius: var(--radius-sm);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		transition: opacity 0.15s;
	}

	.task-add-btn:hover {
		opacity: 0.85;
	}

	.task-summary {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		margin: var(--spacing-xs) 0 0 0;
		text-align: right;
	}
</style>
