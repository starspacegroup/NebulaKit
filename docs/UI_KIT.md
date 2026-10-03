# UI Kit

Standard elements in `src/lib/ui`, imported from one place:

```ts
import { Button, TextInput, Dialog, Tabs, Table, toast } from '$lib/ui';
```

Every element is shown running, with the code for it, at **`/components`**.

---

## What is in it

| Group        | Components                                                                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actions      | `Button`, `ButtonGroup`, `Menu`, `DropdownMenu`, `Command`, `Toggle`, `ToggleGroup`                                                                                                             |
| Forms        | `Field`, `TextInput`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Slider`, `Combobox`, `Calendar`, `DatePicker`, `InputOTP`, `InputGroup`, `NumberInput`, `TagInput`, `FileDrop` |
| Feedback     | `Alert`, `Toaster` + `toast`, `Badge`, `Progress`, `Spinner`, `Skeleton`                                                                                                                        |
| Overlays     | `Dialog`, `AlertDialog`, `Sheet`, `Popover`, `HoverCard`, `Tooltip`, `ContextMenu`                                                                                                              |
| Navigation   | `Tabs`, `Accordion`, `Breadcrumbs`, `Pagination`, `Menubar`, `NavigationMenu`, `Sidebar`, `Stepper`                                                                                             |
| Layout       | `Container`, `Stack`, `Separator`, `AspectRatio`, `ScrollArea`, `Resizable`, `Collapsible`                                                                                                      |
| Data display | `Card`, `Item`, `Table`, `DataTable`, `BarChart`, `LineChart`, `DonutChart`, `Stat`, `Carousel`, `Timeline`, `Avatar`, `AvatarGroup`, `Kbd`, `CodeBlock`, `Prose`, `EmptyState`                 |

That is every element shadcn/ui ships, and more, with no dependency beyond
Svelte: the charts are plain SVG, the date maths is plain arithmetic, and
nothing is a paid add-on. The kit is MIT-licensed with the rest of NebulaKit.

Widgets for the board (`stat`, `clock`, `checklist`, `meter`, `notes`, `links`)
live in `src/lib/widgets`; see [WIDGET_BOARD.md](./WIDGET_BOARD.md).

---

## The rules every element follows

1. **CSS variables only** (AGENTS.md §3). Solid fills with white text use
   `--color-primary-solid`, `--color-danger-solid` and `--color-on-solid`.
   The dark theme's `--color-primary` is tuned for text on a dark ground, and
   white on it is only 3.7:1; every `*-solid` pair is at least 4.5:1.
2. **Native first.** `Dialog` is `<dialog>`, `Accordion` is `<details>`,
   `Select` is `<select>`, `Switch` is a checkbox with `role="switch"`. Native
   elements bring focus handling, Escape and assistive-technology support that
   a hand-built version has to re-earn.
3. **Labelled and described.** Every form control is built on `Field`, which
   renders a real `<label for>`, joins the hint and error into
   `aria-describedby`, and sets `aria-invalid` when there is an error.
4. **Keyboard complete.** `Tabs` and `Menu` use roving focus (arrows, Home,
   End, disabled items skipped). `Menu` closes on Escape and returns focus to
   its button. `Tooltip` shows on focus as well as hover, and Escape hides it.
5. **Motion respects the setting.** Spinners slow down, skeletons stop
   shimmering, cards stop lifting under `prefers-reduced-motion`.
6. **Logic in pure modules.** Anything an element works out — page ranges,
   roving focus, sorting, initials, ids, popover placement, command ranking,
   calendar dates, step clamping, chart scales — is a pure function in
   `logic.ts` or an area module (`overlay-logic.ts`, `form-logic.ts`,
   `layout-logic.ts`, `data-logic.ts`). All are re-exported from `$lib/ui`.
   `*.svelte` is excluded from coverage, so this is what keeps the kit tested.
7. **Charts are readable without sight.** Each chart is `role="img"` with a
   summary label, and carries a visually hidden table of its numbers.

---

## Toasts

The root layout renders one `<Toaster />`. Raise a toast from anywhere:

```ts
toast.success('Saved');
toast.danger('Could not reach the server', 0); // 0 = stays until dismissed
const id = toast.info('Uploading…', 0);
toast.dismiss(id);
```

---

## Adding an element

1. Write the logic test, then the logic, in `logic.ts` or the area module
   if it decides anything.
2. Write the component in `src/lib/ui/`, and export it from `index.ts`.
3. Add behaviour tests beside it (`ui.test.ts`, or the area's `overlay.test.ts`,
   `form.test.ts`, `layout.test.ts`, `data.test.ts`). Each area has a
   slot-filling fixture in `tests/fixtures/UiKit*Harness.svelte` that reports
   events through an `onEvent` prop, which works under Svelte 4 and 5 alike.
4. Add an entry to `catalog.ts` and a demo to the group's file in
   `src/routes/components/groups/`.
   `catalog.test.ts` fails until the entry exists.
5. Mention it in `/documentation` and `FEATURES.md` in the same change
   (AGENTS.md §7).
