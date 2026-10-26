import type { ModuleEntry } from '../types';

const group = 'Data & teams' as const;

export const dataModules: ModuleEntry[] = [
	{
		id: 'data-grid',
		name: 'DataGrid',
		group,
		summary:
			'A data table that searches, sorts on several columns, filters by column, pages, selects rows with a bulk-action bar, offers a row menu and a density toggle, and exports the current view as CSV.',
		a11y: 'A labelled region around a real table: sortable headers are buttons with aria-sort (Shift adds a column), the select-all checkbox goes indeterminate, every row checkbox and action button names its row, result counts and sort changes are announced, loading is aria-busy, errors offer a retry. Below about 40rem of its own width the rows become cards whose cells carry their column label.',
		code: `import { DataGrid } from '$lib/modules';

<DataGrid
  label="People"
  {rows}
  columns={[
    { key: 'name', label: 'Name', sortable: true },
    { key: 'team', label: 'Team', sortable: true, filter: 'select', options }
  ]}
  selectable
  bind:selected
  rowActions={[{ id: 'edit', label: 'Edit' }]}
  bulkActions={[{ id: 'delete', label: 'Delete', danger: true }]}
  on:bulkaction={onBulk}
  on:export={(e) => download(e.detail.csv, e.detail.name)}
/>`
	},
	{
		id: 'filter-bar',
		name: 'FilterBar',
		group,
		summary:
			'Active filters as removable chips, an Add filter menu for the ones not yet in use, Clear all, and a spoken result count.',
		a11y: 'A labelled group: each chip has a remove button that names its filter, adding a filter opens a labelled form (Escape cancels) and returns focus to the menu, and every add, remove or clear plus the new result count is announced in a status region.',
		code: `import { FilterBar, toColumnFilters } from '$lib/modules';

<FilterBar
  {defs}
  bind:active
  count={visibleRows.length}
/>
<DataGrid {rows} {columns} filters={toColumnFilters(defs, active)} label="Orders" />`
	},
	{
		id: 'kanban-board',
		name: 'KanbanBoard',
		group,
		summary:
			'Columns of cards you can drag with a pointer or finger, move with the keyboard or a Move menu, limit with WIP caps and add to inline.',
		a11y: 'Every column is a labelled section with a configurable heading level. Cards move by drag, by Space then arrows on the grip, by Alt+arrows, or from a menu that names each destination. Every move or refusal is announced in a live region; a full column says "At limit" in text, not just colour.',
		code: `import { KanbanBoard } from '$lib/modules';

<KanbanBoard
  label="Sprint board"
  columns={[{ id: 'todo', title: 'To do' }, { id: 'doing', title: 'Doing', limit: 3 }]}
  bind:cards
  on:move={(e) => save(e.detail)}
/>`
	},
	{
		id: 'activity-feed',
		name: 'ActivityFeed',
		group,
		summary:
			'A feed grouped by day with avatars, relative times that carry the exact time, and a Load more button.',
		a11y: 'Each day is a heading over an ordered list. Times are <time> elements whose datetime and title are exact. Today and Yesterday come from the now and timeZone you pass, so server and browser agree. After Load more, focus moves to the first new item.',
		code: `import { ActivityFeed } from '$lib/modules';

<ActivityFeed
  label="Recent activity"
  {items}
  now={new Date('2026-10-13T15:00:00Z')}
  hasMore
  on:loadmore={loadOlder}
/>`
	},
	{
		id: 'comment-thread',
		name: 'CommentThread',
		group,
		summary:
			'A discussion with replies nested three levels deep, a compose box with a character limit, edit and delete on your own comments, emoji reactions and collapsible branches.',
		a11y: 'The thread is a nested list of articles. The compose field is labelled and tied to its character count and error (aria-describedby, aria-invalid, role="alert"); the remaining count is only spoken near the limit. Reactions are toggle buttons with aria-pressed, branches use aria-expanded, delete asks first, and focus lands on the new or edited comment.',
		code: `import { CommentThread } from '$lib/modules';

<CommentThread
  bind:comments
  currentUser={{ id: 'u1', name: 'Ada Lovelace' }}
  {now}
  maxLength={500}
  on:post={(e) => save(e.detail.comment)}
/>`
	},
	{
		id: 'team-members',
		name: 'TeamMembers',
		group,
		summary:
			'Members with role selects and confirmed removal, an invite dialog that takes many email addresses at once, and pending invites you can resend or revoke.',
		a11y: 'Role selects and buttons carry the member name. The last owner is locked with the reason available to assistive technology. The invite dialog uses a tag input that refuses invalid, duplicate and existing addresses with a message. Removing and revoking ask first, and results are announced.',
		code: `import { TeamMembers } from '$lib/modules';

<TeamMembers
  bind:members
  bind:invites
  currentUserId="u1"
  {now}
  on:invite={(e) => api.invite(e.detail.emails, e.detail.role)}
/>`
	},
	{
		id: 'file-manager',
		name: 'FileManager',
		group,
		summary:
			'Browse folders, switch between list and grid, upload with a progress queue you can cancel, rename in place, select several files and delete with confirmation.',
		a11y: 'Breadcrumbs are a labelled nav with aria-current. Items have a checkbox, a menu and a name button, and each file type shows an icon plus a word. Rename is an inline labelled field (Enter saves, Escape cancels) with errors tied to it. Uploads are a list of real progress bars with a named Cancel button; drops, navigation and deletes are announced.',
		code: `import { FileManager, setUploadProgress } from '$lib/modules';

<FileManager
  label="Project files"
  bind:entries
  bind:folderId
  bind:uploads
  maxBytes={5_000_000}
  on:upload={(e) => start(e.detail.jobs, e.detail.files)}
/>`
	},
	{
		id: 'calendar-schedule',
		name: 'CalendarSchedule',
		group,
		summary:
			'A month grid with events, previous, next and Today controls, the agenda for the picked day, and a dialog to add, edit and delete events.',
		a11y: 'The month is an ARIA grid with one tab stop: arrows move by day or week, Home and End to the ends of the week, PageUp and PageDown by month. Each day is named with its date and event count, today is marked with aria-current, the month title is a polite live region, and the agenda list carries the same events in plain text for narrow screens.',
		code: `import { CalendarSchedule } from '$lib/modules';

<CalendarSchedule
  label="Team calendar"
  bind:events
  {now}
  weekStart={1}
  on:add={(e) => api.create(e.detail.event)}
/>`
	},
	{
		id: 'tree-view',
		name: 'TreeView',
		group,
		summary:
			'A hierarchy with expand and collapse, selection and type-ahead, built to the WAI-ARIA tree pattern.',
		a11y: 'role="tree" with treeitems exposing aria-level, aria-posinset, aria-setsize, aria-expanded and aria-selected. One item is in the tab order; Up and Down move, Right opens then enters, Left closes then goes to the parent, Home and End jump, * opens siblings, Enter or Space selects, and typing letters jumps to the next matching label.',
		code: `import { TreeView } from '$lib/modules';

<TreeView
  label="Project files"
  {nodes}
  bind:expanded
  bind:selected
  on:select={(e) => open(e.detail.id)}
/>`
	},
	{
		id: 'audit-log',
		name: 'AuditLog',
		group,
		summary:
			'A filterable table of events with severity badges, expandable JSON details and CSV export.',
		a11y: 'Filters sit in a labelled search form with a real fieldset for severities; the matching count is announced. Severity is always a word beside the badge colour. Each row has a details button with aria-expanded and aria-controls naming its event, and the table scrolls inside a focusable labelled region on narrow screens.',
		code: `import { AuditLog } from '$lib/modules';

<AuditLog
  label="Security events"
  {events}
  timeZone="UTC"
  on:export={(e) => download(e.detail.csv, e.detail.name)}
/>`
	}
];
