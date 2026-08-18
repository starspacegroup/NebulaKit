# Widget Board

A columned board of draggable widgets, and the drag behaviour underneath it.
Works with a mouse, a finger, or a keyboard alone.

The widget registry ships **empty** — the kit gives you the mechanism, not
someone else's widgets.

---

## The five layers

| Layer | File                                    | Job                                             |
| ----- | --------------------------------------- | ----------------------------------------------- |
| L1    | `src/lib/utils/reorder.ts`              | Pure list surgery. No DOM, no Svelte            |
| L1    | `src/lib/utils/drop-position.ts`        | Pure hit-testing geometry                       |
| L2    | `src/lib/actions/draggable.ts`          | Pointer, touch and keyboard; ghost; auto-scroll |
| L3    | `src/lib/components/WidgetBoard.svelte` | Columns, drop handling, rendering               |
| L4    | `src/lib/widgets/`                      | Manifest + component registry                   |

The split is the point. Everything that historically produced ordering bugs
lives in L1, where it is tested against plain numbers instead of a browser.

---

## Using the board

```svelte
<script lang="ts">
	import WidgetBoard from '$lib/components/WidgetBoard.svelte';
	import type { BoardColumn, BoardWidget } from '$lib/widgets/types';

	let widgets: BoardWidget[] = [{ id: 'notes-1', type: 'notes', group: 'left', order: 0 }];
	const columns: BoardColumn[] = [
		{ id: 'left', title: 'Left' },
		{ id: 'right', title: 'Right' }
	];
</script>

<WidgetBoard bind:widgets {columns} on:change={(event) => save(event.detail.widgets)}>
	<svelte:fragment slot="actions" let:widget>
		<button on:click={() => remove(widget.id)}>Remove</button>
	</svelte:fragment>
</WidgetBoard>
```

| Prop           | Default            | Meaning                                               |
| -------------- | ------------------ | ----------------------------------------------------- |
| `widgets`      | `[]`               | The layout. `bind:` to keep a parent copy in step     |
| `columns`      | `[]`               | Columns, left to right                                |
| `live`         | `{}`               | Display-only titles by widget id (see P4 below)       |
| `editable`     | `true`             | `false` renders a read-only board with no handles     |
| `emptyMessage` | `Nothing here yet` | Shown in a column with nothing in it                  |
| `board`        | `widget-board`     | Distinguishes two boards on a page. Drags never cross |

### Events

| Event       | Detail          | When                                   |
| ----------- | --------------- | -------------------------------------- |
| `on:change` | `{ widgets }`   | A drop actually changed the layout     |
| `on:live`   | `{ id, value }` | A widget reported a display-only value |

`on:change` fires only on a real change, so wiring it straight to a save is safe.

`on:live` is the return half of the `live` prop: a widget dispatches `live` with
a string, the board tags it with the widget's id, and the app feeds it back in.

```svelte
<WidgetBoard
	bind:widgets
	{columns}
	{live}
	on:change={(e) => save(e.detail.widgets)}
	on:live={(e) => (live = { ...live, [e.detail.id]: e.detail.value })}
/>
```

A widget with a ticking value dispatches rather than writing to its own title:

```svelte
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	const dispatch = createEventDispatcher<{ live: string }>();

	// Wait for mount: Svelte attaches a parent's `on:live` after constructing
	// the component, so a dispatch during init reaches nobody.
	let mounted = false;
	onMount(() => (mounted = true));
	$: if (mounted) dispatch('live', time);
</script>
```

## Using the actions on their own

The board is one consumer of `use:draggable`. A sortable list, a nav reorder, or
anything else needs no board:

```svelte
<script lang="ts">
	import { draggable, dropzone } from '$lib/actions/draggable';
	import { reorder } from '$lib/utils/reorder';

	let items = [{ id: 'a', group: 'list', order: 0 }];
	const onDrop = ({ id, toGroup, toIndex }) => (items = reorder(items, id, toGroup, toIndex));
</script>

<ul use:dropzone={{ group: 'list' }}>
	{#each items as item (item.id)}
		<li use:draggable={{ id: item.id, group: 'list', label: item.name, onDrop }}>
			<button data-drag-handle aria-label={`Move ${item.name}`}>⠿</button>
			{item.name}
		</li>
	{/each}
</ul>
```

Two requirements:

- **The `{#each}` must be keyed.** Svelte moves keyed nodes instead of rebuilding
  them, which is what keeps focus on the handle through a keyboard reorder.
- **Give an empty zone a `min-height`.** A zone with no height cannot be dropped
  into, and an empty column you cannot fill is the most common way a board like
  this feels broken.

---

## Registering a widget

Three edits, none of them to the board:

1. **`src/lib/widgets/manifest.ts`** — metadata only, no `.svelte` imports, so
   Workers, tests and migrations can read it:

   ```ts
   export const widgetManifest: WidgetDefinition[] = [
   	{ name: 'notes', label: 'Notes', description: 'A scratch pad.', defaultProps: { text: '' } }
   ];
   ```

2. **`src/lib/widgets/index.ts`** — the type → component map:

   ```ts
   import Notes from '$lib/widgets/Notes.svelte';
   const widgetComponents = { notes: Notes };
   ```

3. **The component itself.** Props in, events out; the board spreads
   `{ ...defaultProps, ...widget.props }` into it.

A widget type with no registered component renders a labelled placeholder rather
than an empty frame. A stored layout is untrusted input, and a missing widget
should say so.

### What a built-in component owes

Every component added to this library ships with all six:

1. A manifest entry (`name`, `label`, `description`, `defaultProps`).
2. The component: props in, events out. No direct store reads, no network calls
   in the component body.
3. Theme compliance — CSS variables only, light and dark parity (AGENTS.md §3).
4. Tests, written first, holding the 95% coverage floor (AGENTS.md §1).
5. A `/documentation` entry, in the same change (AGENTS.md §7).
6. A `FEATURES.md` bullet.

---

## Keyboard and screen readers

Focus a drag handle, then:

| Key                | Effect                                    |
| ------------------ | ----------------------------------------- |
| Space or Enter     | Pick up, and drop again                   |
| Arrow up / down    | Move within the column                    |
| Arrow left / right | Move to the next column across            |
| Escape             | Cancel, returning the item where it began |
| Tab                | Drop where it stands and move on          |

Each move commits immediately and is announced through a shared `aria-live`
region, so a screen-reader user hears "moved to position 2 of 4 in Right".
Handles that are not `<button>`s are given `tabindex` and `role` by the action.

Translate the announcements by assigning to `dragMessages`:

```ts
import { dragMessages } from '$lib/actions/draggable';
dragMessages.grabbed = (label, position, total) => `${label} agarrado. ${position} de ${total}.`;
```

---

## The four rules this design enforces

Each one is a defect that was paid for once already, in the dashboard app this
board was distilled from.

### P1 — Order is derived, never patched

`reorder()` models a move as remove → clamp → splice → reindex over a sorted
array. It never adjusts an item's `order` with arithmetic.

The predecessor used a chain of `if / else-if` ±1 conditionals. For a move within
one column, an item between the source and the destination needs both the
source-side decrement and the destination-side increment, but `else-if` allows
only the first. Moving A in `[A0,B1,C2,D3]` to index 2 produced `A=2, B=1, C=1,
D=2` — two collisions, after which render order depended on sort stability.
Widgets appeared to jump back, swap with a neighbour, or not move at all.

### P2 — Carry identity, never position

`use:draggable` and `use:dropzone` stamp `data-drag-item` and `data-drag-group`
themselves, and hit-testing resolves a target through those attributes.

The predecessor reported the target column as _its index in a
`querySelectorAll`_, while the reducer treated that number as a column id. The
two agree only in a pristine layout. After any column move, a drop landed in the
wrong column — or on an id with no column, where the widget vanished until
reload.

### P3 — Hit-test in the space you mutate

The insertion index is computed over the sibling list **with the dragged item
excluded**, because that is exactly the list `reorder()` splices into.

During a drag the source element stays in the DOM; only a ghost moves. Counting
it makes every downward move land one slot too high, and "drop just after
myself" reads as a no-op.

### P4 — Persisted state must be inert

`BoardWidget` is persisted state, so nothing in it may change on a timer. A
widget with a live value — a price, a clock, a connection count — dispatches
`live` instead, and the board renders `live[id] ?? widget.title`. Persisted state
never moves, so nothing schedules a write.

The predecessor put live values in the widget title, and the title was part of
synced state. Every 30–60 second tick rewrote the whole layout: about 650 writes
a day against a 1,000/day account-wide free limit, from a single open tab.

`reorder()` also returns the **same array reference** when a drop changed
nothing, so an idle board cannot write at all:

```ts
const next = reorder(widgets, id, toGroup, toIndex);
if (next === widgets) return; // nothing moved; do not persist
```

---

## Styling hooks

Presentation lives in `src/app.css`, not in the action, so a project can restyle
a drag without touching its behaviour.

| Selector                     | What it styles                                |
| ---------------------------- | --------------------------------------------- |
| `[data-drag-handle]`         | The grab handle. Owns its gesture (see below) |
| `[data-dragging]`            | The item left behind during a drag            |
| `[data-dragging='keyboard']` | The item while held by the keyboard           |
| `.drag-ghost`                | The copy that follows the pointer             |
| `.drop-indicator`            | Where the item would land                     |

The indicator is zero-height, with its bar drawn by a pseudo-element. A bar that
occupies real space shifts every item below it, which moves the very midpoints
the insertion index was computed from — the list then flickers between two
positions while the pointer holds still.

### What a handle has to suppress

A handle carries three things, and dropping any of them breaks touch dragging in
a way that looks like the drag is simply being ignored:

| Property                      | Without it                                     |
| ----------------------------- | ---------------------------------------------- |
| `touch-action: none`          | The press scrolls the page instead of dragging |
| `user-select: none`           | The press selects text instead of dragging     |
| `-webkit-touch-callout: none` | iOS raises Copy / Search off the long press    |

The action sets the last two on `<body>` for the duration of a drag as well, but
that is a backstop: on iOS the selection gesture begins before the 300 ms hold
has elapsed, so the handle's own rules are what actually prevent it.

Make the same surfaces non-selectable in your own widget chrome. Anything a
finger might land on while reaching for the handle — a title bar, a toolbar — is
chrome rather than content, and leaving it selectable is the most common way
"hold to drag" turns into "iOS offers to search Google for my widget's title".

### Touch target size

Give the handle at least ~44px under `@media (pointer: coarse)`. A six-dot grip
is a 10x16 target: fine for a cursor, well under what a fingertip can hit. The
press lands next to it instead, which is exactly the case the rules above have to
cover. `<WidgetBoard>` does this for its own handle.

---

## Testing

`happy-dom` has no layout engine, so `getBoundingClientRect` returns zeros. Any
test that exercises pointer geometry must stub rects on the elements it cares
about; `src/lib/actions/draggable.test.ts` shows the pattern. The keyboard path
needs no geometry at all, which makes it the cheapest way to test a board end to
end.

---

## Not built yet

- **A persistence adapter.** `on:change` hands you the new layout; storing it is
  currently the app's job.
- **Built-in widgets.** The registry is empty; there is no notes, stat or clock
  widget yet.

See `planning/COMPONENT_LIBRARY.md` in the workspace for the full plan.
