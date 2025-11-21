<script lang="ts">
	interface Task {
		id: string;
		title: string;
		description: string;
	}
	
	interface Column {
		id: string;
		title: string;
		tasks: Task[];
	}
	
	let columns: Column[] = [
		{
			id: 'todo',
			title: 'To Do',
			tasks: [
				{ id: '1', title: 'Design UI', description: 'Create mockups for new feature' },
				{ id: '2', title: 'Setup API', description: 'Configure backend endpoints' }
			]
		},
		{
			id: 'in-progress',
			title: 'In Progress',
			tasks: [
				{ id: '3', title: 'Implement Auth', description: 'Add user authentication' }
			]
		},
		{
			id: 'done',
			title: 'Done',
			tasks: [
				{ id: '4', title: 'Project Setup', description: 'Initialize repository' }
			]
		}
	];
	
	let draggedTask: Task | null = null;
	let draggedFromColumn: string | null = null;
	let touchStartY = 0;
	let touchStartX = 0;
	let isDragging = false;
	
	function handleDragStart(e: DragEvent, task: Task, columnId: string) {
		draggedTask = task;
		draggedFromColumn = columnId;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
		}
	}
	
	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	}
	
	function handleDrop(e: DragEvent, targetColumnId: string) {
		e.preventDefault();
		
		if (!draggedTask || !draggedFromColumn) return;
		
		// Remove from source column
		const sourceColumn = columns.find(c => c.id === draggedFromColumn);
		if (sourceColumn) {
			sourceColumn.tasks = sourceColumn.tasks.filter(t => t.id !== draggedTask!.id);
		}
		
		// Add to target column
		const targetColumn = columns.find(c => c.id === targetColumnId);
		if (targetColumn) {
			targetColumn.tasks = [...targetColumn.tasks, draggedTask];
		}
		
		columns = columns;
		draggedTask = null;
		draggedFromColumn = null;
	}
	
	// Touch/Mobile support
	function handleTouchStart(e: TouchEvent, task: Task, columnId: string) {
		const touch = e.touches[0];
		touchStartY = touch.clientY;
		touchStartX = touch.clientX;
		draggedTask = task;
		draggedFromColumn = columnId;
		isDragging = false;
	}
	
	function handleTouchMove(e: TouchEvent) {
		if (!draggedTask) return;
		
		const touch = e.touches[0];
		const deltaY = Math.abs(touch.clientY - touchStartY);
		const deltaX = Math.abs(touch.clientX - touchStartX);
		
		if (deltaY > 10 || deltaX > 10) {
			isDragging = true;
			e.preventDefault();
		}
	}
	
	function handleTouchEnd(e: TouchEvent, targetColumnId: string) {
		if (!isDragging || !draggedTask || !draggedFromColumn) {
			draggedTask = null;
			draggedFromColumn = null;
			isDragging = false;
			return;
		}
		
		// Same logic as drop
		const sourceColumn = columns.find(c => c.id === draggedFromColumn);
		if (sourceColumn) {
			sourceColumn.tasks = sourceColumn.tasks.filter(t => t.id !== draggedTask!.id);
		}
		
		const targetColumn = columns.find(c => c.id === targetColumnId);
		if (targetColumn) {
			targetColumn.tasks = [...targetColumn.tasks, draggedTask];
		}
		
		columns = columns;
		draggedTask = null;
		draggedFromColumn = null;
		isDragging = false;
	}
</script>

<svelte:head>
	<title>Demo - NebulaKit</title>
</svelte:head>

<div class="demo-page">
	<div class="container">
		<div class="demo-header">
			<h1>Drag & Drop Demo</h1>
			<p class="subtitle">Works on desktop and mobile devices</p>
		</div>
		
		<div class="kanban-board">
			{#each columns as column (column.id)}
				<div
					class="column"
					on:dragover={handleDragOver}
					on:drop={(e) => handleDrop(e, column.id)}
					role="region"
					aria-label={column.title}
				>
					<div class="column-header">
						<h3>{column.title}</h3>
						<span class="task-count">{column.tasks.length}</span>
					</div>
					
					<div class="tasks">
						{#each column.tasks as task (task.id)}
							<div
								class="task"
								class:dragging={draggedTask?.id === task.id}
								draggable="true"
								on:dragstart={(e) => handleDragStart(e, task, column.id)}
								on:touchstart={(e) => handleTouchStart(e, task, column.id)}
								on:touchmove={handleTouchMove}
								on:touchend={(e) => handleTouchEnd(e, column.id)}
								role="button"
								tabindex="0"
							>
								<div class="task-header">
									<h4>{task.title}</h4>
									<span class="drag-handle">⋮⋮</span>
								</div>
								<p>{task.description}</p>
							</div>
						{/each}
						
						{#if column.tasks.length === 0}
							<div class="empty-state">
								Drop tasks here
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.demo-page {
		padding: var(--spacing-xl) 0;
		min-height: calc(100vh - 64px);
	}
	
	.demo-header {
		text-align: center;
		margin-bottom: var(--spacing-2xl);
	}
	
	.demo-header h1 {
		margin-bottom: var(--spacing-xs);
	}
	
	.subtitle {
		color: var(--color-text-secondary);
	}
	
	.kanban-board {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-lg);
		margin-bottom: var(--spacing-2xl);
	}
	
	@media (min-width: 768px) {
		.kanban-board {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	
	.column {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-md);
		min-height: 400px;
		display: flex;
		flex-direction: column;
	}
	
	.column-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--spacing-md);
		padding-bottom: var(--spacing-sm);
		border-bottom: 1px solid var(--color-border);
	}
	
	.column-header h3 {
		font-size: 1.125rem;
	}
	
	.task-count {
		background: var(--color-background);
		color: var(--color-text-secondary);
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 500;
	}
	
	.tasks {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}
	
	.task {
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		cursor: move;
		transition: all var(--transition-fast);
		touch-action: pan-y;
	}
	
	.task:hover {
		box-shadow: var(--shadow-md);
		transform: translateY(-2px);
	}
	
	.task.dragging {
		opacity: 0.5;
		transform: scale(0.95);
	}
	
	.task-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--spacing-xs);
	}
	
	.task-header h4 {
		font-size: 1rem;
		font-weight: 600;
	}
	
	.drag-handle {
		color: var(--color-text-secondary);
		font-size: 1.25rem;
		cursor: grab;
		user-select: none;
	}
	
	.task:active .drag-handle {
		cursor: grabbing;
	}
	
	.task p {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		line-height: 1.5;
	}
	
	.empty-state {
		padding: var(--spacing-xl);
		text-align: center;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-md);
	}
</style>
