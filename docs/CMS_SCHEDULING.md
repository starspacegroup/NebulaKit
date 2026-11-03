# Scheduled publishing

Set a CMS item to publish at a later time. In the editor, choose **Published** and fill in
**Publish at**. Leave it empty to publish now.

## How it works

There is no `scheduled` status. A scheduled item is `published` with a `published_at` that is still
in the future. Every public surface checks the date, so nothing has to run when the time arrives:
the item starts passing the check.

| Surface | Scheduled item |
| --- | --- |
| Public list (`/blog`) | Hidden until its time. `listContentItems` takes `liveOnly: true`. |
| Public item page | `404` until its time. |
| Sitemap, command palette | Left out until its time (`liveSql()` in `src/lib/cms/schedule.ts`). |
| Admin list | Shown with a **scheduled** badge. Admin APIs are not date-filtered. |

Pages that cache, such as the sitemap (10 minutes), show the item when their cache expires.

## Rules

- `publishedAt` on `POST /api/cms/[type]` and `PUT /api/cms/[type]/[id]` is an ISO date. `null`
  publishes now. An invalid value is a `400`.
- It is only used when `status` is `published`. A draft keeps whatever date it had.
- A scheduled item can be rescheduled, or brought forward by sending `publishedAt: null`.
- Once an item has gone live its `published_at` never moves. Locked fields, the title and slug lock,
  and the delete protection all key off that date, and they only apply once it has arrived. A
  scheduled item is still freely editable.
- A date in the past publishes immediately with that date, which is how an older post can be
  backdated.

## Timestamp proof

If a content type has `enableTimestampProof`, the proof job starts when an item first goes live from
a save. A scheduled item has no public page yet, so the job does not start when it is scheduled, and
nothing starts it automatically at go-live. Re-request the proof after the date, or add a cron route
that finds live items with no proof. See `src/lib/content-proof/proof-job.ts`.

## Code

- `src/lib/cms/schedule.ts` — date logic, `liveSql()`, and the `datetime-local` helpers.
- `src/lib/services/cms.ts` — create and update store the date; the list, sitemap and palette
  queries filter on it.
- `src/lib/components/CmsItemEditor.svelte` — the **Publish at** field.
